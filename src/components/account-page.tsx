"use client";
import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Heart,
  Info,
  Loader2,
  LogOut,
  MapPin,
  Mail,
  Package,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { useStore } from "./store-provider";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./ui/dialog";
import { ShippingFields } from "./shipping-fields";
import { ReceiptDetails } from "./receipt-page";
import { previewAccountSchema, shippingSchema } from "@/lib/validation";
import { useFieldValidation } from "./use-field-validation";
import type { Receipt, ShippingAddress } from "@/lib/types";
import { money, cn } from "@/lib/utils";
function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6C44.4 38.02 46.98 31.85 46.98 24.55Z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59a14.42 14.42 0 0 1 0-9.18l-7.98-6.19A23.81 23.81 0 0 0 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19Z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.16 1.45-4.93 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z"
      />
    </svg>
  );
}
export function AccountPage({
  defaultTab = "orders",
}: {
  defaultTab?: string;
}) {
  const {
    user,
    config,
    demoSignIn,
    googleSignIn,
    logout,
    orders: demoOrders,
    deliveryState,
    wishlist,
    hydrated,
    repeatOrder,
  } = useStore();
  const params = useSearchParams();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [tab, setTab] = useState(defaultTab);
  const [busy, setBusy] = useState(false);
  const [liveOrders, setLiveOrders] = useState<Receipt[]>([]);
  const [ordersOwner, setOrdersOwner] = useState<string | null>(null);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Receipt | null>(null);
  const [fetchError, setFetchError] = useState("");
  const [googleSetup, setGoogleSetup] = useState(false);
  const loginFields = useFieldValidation(previewAccountSchema, { name, email });
  const [address, setAddress] = useState<ShippingAddress>({
    fullName: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "Lagos",
  });
  const addressFields = useFieldValidation(shippingSchema, address);
  const orders = config.demo
    ? demoOrders.filter(
        (o) => (o as Receipt & { customerId?: string }).customerId === user?.id,
      )
    : ordersOwner === user?.id
      ? liveOrders
      : [];
  useEffect(() => {
    if (!user) return;
    setSelectedOrder(null);
    setAddress((current) => ({
      ...current,
      fullName: user.name,
      email: user.email,
      state: deliveryState,
    }));
    if (config.demo) {
      try {
        const saved = JSON.parse(
          localStorage.getItem(`kora-address-${user.id}`) || "null",
        );
        if (saved) setAddress(saved);
      } catch {}
      return;
    }
    setLoadingOrders(true);
    setFetchError("");
    let cancelled = false;
    void Promise.all([
      fetch("/api/orders").then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        return d;
      }),
      fetch("/api/account").then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([rows, profile]) => {
        if (!cancelled) {
          setLiveOrders(rows);
          setOrdersOwner(user.id);
          if (profile?.shipping) setAddress(profile.shipping);
        }
      })
      .catch((e) => {
        if (!cancelled) setFetchError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoadingOrders(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id, config.demo]);
  async function google() {
    if (!config.googleEnabled) {
      setGoogleSetup(true);
      return;
    }
    setBusy(true);
    try {
      await googleSignIn();
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(false);
    }
  }
  async function signout() {
    setBusy(true);
    try {
      await logout();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function saveAddress(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const parsed = addressFields.validate();
    if (!parsed.success) {
      document
        .getElementById(`shipping-${String(parsed.error.issues[0].path[0])}`)
        ?.focus();
      return;
    }
    setBusy(true);
    try {
      if (config.demo)
        localStorage.setItem(
          `kora-address-${user!.id}`,
          JSON.stringify(parsed.data),
        );
      else {
        const response = await fetch("/api/account", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed.data),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
      }
      toast.success("Your delivery details are saved.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!hydrated)
    return (
      <div className="page-width status-page">
        <Loader2 className="animate-spin mx-auto" />
      </div>
    );
  if (!user)
    return (
      <div className="page-width signin-page">
        <div className="signin-story">
          <p className="eyebrow">YOUR LITTLE CORNER OF KORA</p>
          <h1>
            Good to
            <br />
            have you <em>here.</em>
          </h1>
          <p>
            All your favourites, your good finds, and your next little upgrade.
            In one place.
          </p>
          <div>
            <span>
              <Package size={21} />
              Keep track of your orders
            </span>
            <span>
              <Heart size={21} />
              Keep your favourites close
            </span>
            <span>
              <MapPin size={21} />
              Make checkout a little smoother
            </span>
          </div>
        </div>
        <div className="signin-card">
          <div className="signin-icon">
            <UserRound size={27} strokeWidth={1.3} />
          </div>
          <h2>Welcome to your everyday.</h2>
          <p>Sign in and pick up right where you left off.</p>
          {params.get("error") && (
            <div className="checkout-error" role="alert">
              Sign-in didn't finish. Please try again or check that Google
              authentication is configured.
            </div>
          )}
          <>
            <Button
              variant="outline"
              className="w-full mt-7"
              onClick={google}
              disabled={busy}
            >
              <GoogleMark />
              {busy && <Loader2 size={16} className="animate-spin" />}
              {busy ? "Opening Google..." : "Continue with Google"}
            </Button>
            {!config.googleEnabled && (
              <p className="signin-google-note">
                Google sign-in is awaiting store setup.
              </p>
            )}
          </>
          {config.demo ? (
            <>
              <div className="signin-divider">or explore a preview account</div>
              <div className="account-demo-note">
                <Info size={16} />
                <span>Try a preview account. It stays in this browser.</span>
              </div>
              <form
                noValidate
                onSubmit={(e) => {
                  e.preventDefault();
                  const parsed = loginFields.validate();
                  if (!parsed.success) {
                    document
                      .getElementById(
                        `demo-${String(parsed.error.issues[0].path[0])}`,
                      )
                      ?.focus();
                    return;
                  }
                  demoSignIn(parsed.data.name, parsed.data.email);
                  const next = params.get("next");
                  if (next?.startsWith("/") && !next.startsWith("//"))
                    router.push(next);
                }}
                className="demo-login-form"
              >
                <label htmlFor="demo-name">Your name</label>
                <input
                  id="demo-name"
                  placeholder="e.g. Amaka"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={() => loginFields.touch("name")}
                  aria-invalid={!!loginFields.errors.name}
                  aria-describedby={
                    loginFields.errors.name ? "demo-name-error" : undefined
                  }
                  required
                  minLength={2}
                  maxLength={100}
                  autoComplete="given-name"
                />
                {loginFields.errors.name && (
                  <small className="field-error" id="demo-name-error">
                    {loginFields.errors.name}
                  </small>
                )}
                <label htmlFor="demo-email">Email address</label>
                <input
                  id="demo-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => loginFields.touch("email")}
                  aria-invalid={!!loginFields.errors.email}
                  aria-describedby={
                    loginFields.errors.email ? "demo-email-error" : undefined
                  }
                  required
                  maxLength={254}
                  autoComplete="email"
                />
                {loginFields.errors.email && (
                  <small className="field-error" id="demo-email-error">
                    {loginFields.errors.email}
                  </small>
                )}
                <Button type="submit" className="w-full mt-5">
                  Explore your demo account
                </Button>
              </form>
            </>
          ) : !config.googleEnabled ? (
            <div className="account-demo-note">
              <Info size={17} />
              <p>
                Account sign-in is being set up. You can still browse and check
                out as a guest.
              </p>
            </div>
          ) : null}
          <div className="signin-security">
            <ShieldCheck size={15} />
            Guest picks carry over. Account picks stay saved.
          </div>
          <Link className="signin-guest" href="/shop">
            Continue exploring as a guest <ArrowUpRight size={15} />
          </Link>
          {config.emailTestingAvailable && (
            <Link href="/email-test" className="signin-guest">
              <Mail size={15} /> Test email delivery
            </Link>
          )}
          <Link href="/track-order"><Package size={18} />Track your delivery</Link>
          {config.ownerToolsAvailable && <Link href="/admin/orders"><ShieldCheck size={18} />Manage deliveries</Link>}
        </div>
        <Dialog open={googleSetup} onOpenChange={setGoogleSetup}>
          <DialogContent className="google-setup-dialog">
            <div className="success-modal-mark">
              <GoogleMark />
            </div>
            <DialogTitle>Google sign-in is coming soon.</DialogTitle>
            <DialogDescription>
              The store needs to connect Google authentication before you can
              sign in with Google. Your guest bag will carry over when you sign
              in.
            </DialogDescription>
            <Button
              className="w-full mt-6"
              onClick={() => setGoogleSetup(false)}
            >
              Got it
            </Button>
          </DialogContent>
        </Dialog>
      </div>
    );
  return (
    <div className="page-width account-page">
      <div className="breadcrumb">
        <Link href="/">Home</Link>
        <span>/</span>
        <span>Your account</span>
      </div>
      <p className="eyebrow">YOUR LITTLE CORNER OF KORA</p>
      <div className="account-heading">
        <div>
          <h1>Hello, {user.name.split(" ")[0]}.</h1>
          <p>A good day to find something you love.</p>
        </div>
        <Button variant="outline" size="sm" onClick={signout} disabled={busy}>
          <LogOut size={15} />
          Sign out
        </Button>
      </div>
      <div className="account-layout">
        <nav className="account-nav" aria-label="Account sections">
          <button
            className={cn(tab === "orders" && "selected")}
            onClick={() => setTab("orders")}
          >
            <Package size={18} />
            Your orders <span>{orders.length}</span>
          </button>
          <button
            className={cn(tab === "details" && "selected")}
            onClick={() => setTab("details")}
          >
            <UserRound size={18} />
            Your details
          </button>
          <Link href="/wishlist">
            <Heart size={18} />
            Your favourites <span>{wishlist.length}</span>
          </Link>
          {config.emailTestingAvailable && (
            <Link href="/email-test">
              <Mail size={18} /> Test email delivery
            </Link>
          )}
          <div className="account-user">
            <span>{user.name[0]}</span>
            <div>
              <b>{user.name}</b>
              <small>{user.email}</small>
              {config.demo && (
                <small className="text-primary">Preview account</small>
              )}
            </div>
          </div>
        </nav>
        <div className="account-content">
          {tab === "orders" ? (
            <>
              <h2>Your good finds.</h2>
              <p className="text-sm text-subtle mb-6">
                Every order, all in one place.
              </p>
              {loadingOrders ? (
                <Loader2 className="animate-spin" />
              ) : fetchError ? (
                <div className="checkout-error">{fetchError}</div>
              ) : orders.length ? (
                <div className="orders-list">
                  {orders.map((order) => (
                    <button
                      className="order-list-item"
                      key={order.id}
                      onClick={() => setSelectedOrder(order)}
                    >
                      <div className="order-list-icon">
                        <Package size={22} />
                      </div>
                      <div>
                        <b>Order {order.id.slice(0, 8).toUpperCase()}</b>
                        <small>
                          {new Date(order.createdAt).toLocaleDateString(
                            "en-NG",
                            { dateStyle: "medium" },
                          )}{" "}
                          · {order.items.length}{" "}
                          {order.items.length === 1 ? "find" : "finds"}
                        </small>
                      </div>
                      <span className={`order-status ${order.status}`}>
                        {order.demo
                          ? "Demo order"
                          : order.status === "paid"
                            ? "Confirmed"
                            : order.status === "fulfillment_review"
                              ? "Under review"
                              : order.status}
                      </span>
                      <strong>{money(order.totalNaira)}</strong>
                      <ArrowUpRight size={17} />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="empty-orders">
                  <Package size={34} strokeWidth={1.2} />
                  <h3>Your first good find awaits.</h3>
                  <p>Your orders will feel right at home here.</p>
                  <Button asChild>
                    <Link href="/shop">
                      Find your next favourite <ArrowRight size={17} />
                    </Link>
                  </Button>
                </div>
              )}
            </>
          ) : (
            <>
              <h2>Make yourself at home.</h2>
              <p className="text-sm text-subtle mb-7">
                Save your delivery details for a smoother next visit.
              </p>
              <form noValidate onSubmit={saveAddress} aria-busy={busy}>
                <ShippingFields
                  value={address}
                  onChange={setAddress}
                  includeNotes={false}
                  errors={addressFields.errors}
                  onBlur={addressFields.touch}
                />
                <Button className="mt-6" disabled={busy}>
                  {busy ? "Saving..." : "Save your details"}
                  {busy && <Loader2 size={16} className="animate-spin" />}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
      <Dialog
        open={!!selectedOrder}
        onOpenChange={(open) => {
          if (!open) setSelectedOrder(null);
        }}
      >
        <DialogContent className="order-dialog">
          <DialogTitle className="text-2xl mb-2">
            Your order details.
          </DialogTitle>
          <DialogDescription className="text-sm text-subtle mb-5">
            {selectedOrder?.demo
              ? "Sample receipt · no payment was taken."
              : selectedOrder?.status === "paid"
                ? "Your payment has been confirmed."
                : "Your order and payment status."}
          </DialogDescription>
          {selectedOrder && <ReceiptDetails receipt={selectedOrder} />}
          {selectedOrder &&
            ["demo", "paid", "fulfillment_review"].includes(
              selectedOrder.status,
            ) && (
              <Button
                className="w-full mt-5"
                onClick={() => {
                  repeatOrder(selectedOrder);
                  setSelectedOrder(null);
                }}
              >
                Buy again
              </Button>
            )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
