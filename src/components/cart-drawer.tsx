"use client";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  Minus,
  Plus,
  ShoppingBag,
  Trash2,
  Truck,
  LockKeyhole,
  Loader2,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useStore } from "./store-provider";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
  SheetClose,
} from "./ui/sheet";
import { Button } from "./ui/button";
import { deliveryFee, effectivePrice, money } from "@/lib/utils";
export function QuantityControl({
  quantity,
  onChange,
  max = 99,
  label = "item",
}: {
  quantity: number;
  onChange: (quantity: number) => void;
  max?: number;
  label?: string;
}) {
  return (
    <div className="quantity-control">
      <button
        type="button"
        aria-label={`Decrease quantity of ${label}`}
        onClick={() => onChange(quantity - 1)}
        disabled={quantity <= 1}
      >
        <Minus size={14} />
      </button>
      <span aria-label={`${quantity} selected`}>{quantity}</span>
      <button
        type="button"
        aria-label={`Increase quantity of ${label}`}
        onClick={() => onChange(quantity + 1)}
        disabled={quantity >= max}
      >
        <Plus size={14} />
      </button>
    </div>
  );
}
export function CartDrawer() {
  const {
    items,
    products,
    bagOpen,
    setBagOpen,
    count,
    subtotal,
    setQuantity,
    removeItem,
    deliveryState,
    flushCart,
    config,
    cartReady,
    cartError,
  } = useStore();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (bagOpen) toast.dismiss("kora-bag-added");
  }, [bagOpen]);
  const shipping = deliveryFee(subtotal, deliveryState);
  const remaining = Math.max(0, 100000 - subtotal);
  async function checkout() {
    setBusy(true);
    try {
      await flushCart();
      setBagOpen(false);
      router.push("/checkout");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet open={bagOpen} onOpenChange={setBagOpen}>
      <SheetContent className="cart-sheet">
        <div className="cart-heading">
          <SheetTitle className="text-2xl font-medium">
            Your shopping bag{" "}
            <span className="cart-heading-count">{count}</span>
          </SheetTitle>
          <SheetDescription className="mt-2 text-sm text-subtle">
            Good choices look good on you.
          </SheetDescription>
          <SheetClose className="cart-close" aria-label="Close shopping bag">
            <X size={20} />
          </SheetClose>
        </div>
        {!cartReady ? <div className="empty-bag">{cartError ? <><ShoppingBag size={32} /><h3>Your bag couldn't sync.</h3><p className="field-error">{cartError}</p><p>Use “Retry bag sync” above to reconnect.</p></> : <><Loader2 size={28} className="animate-spin" /><h3>Syncing your shopping bag…</h3><p>Your saved selections will appear here.</p></>}</div> : items.length ? (
          <>
            <div className="shipping-progress">
              <div>
                <Truck size={16} />
                {remaining ? (
                  <span>
                    You're <b>{money(remaining)}</b> away from free delivery.
                  </span>
                ) : (
                  <span>
                    <b>Lovely!</b> Your delivery is on us.
                  </span>
                )}
              </div>
              <div className="progress-track">
                <span
                  style={{
                    width: `${Math.min(100, (subtotal / 100000) * 100)}%`,
                  }}
                />
              </div>
            </div>
            <div className="cart-lines">
              {items.map((line) => {
                const p = products.find((p) => p.id === line.productId);
                if (!p) return null;
                const price = effectivePrice(p);
                return (
                  <div className="cart-line" key={p.id}>
                    <div className="cart-thumb">
                      <Image src={p.imageUrl} alt={p.title} fill sizes="88px" />
                    </div>
                    <div className="cart-line-info">
                      <small>{p.category}</small>
                      <h3>{p.title}</h3>
                      <strong>{money(price)}</strong>
                      <div className="cart-line-bottom">
                        <QuantityControl
                          quantity={line.quantity}
                          onChange={(qty) => setQuantity(p.id, qty)}
                          max={Math.min(99, p.stock - p.reserved)}
                          label={p.title}
                        />
                        <button
                          className="remove-item"
                          onClick={() => removeItem(p.id)}
                          aria-label={`Remove ${p.title} from bag`}
                        >
                          <Trash2 size={15} />
                        </button>
                        <span className="cart-line-total text-sm font-medium">
                          {money(price * line.quantity)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="cart-totals">
              <div>
                <span>Subtotal</span>
                <b>{money(subtotal)}</b>
              </div>
              <div className="text-sm text-subtle">
                <span>Delivery to {deliveryState}</span>
                <span>
                  {shipping ? (
                    money(shipping)
                  ) : (
                    <span className="text-primary">
                      Free <Check size={13} className="inline" />
                    </span>
                  )}
                </span>
              </div>
              <div className="cart-grandtotal">
                <span>Estimated total</span>
                <b>{money(subtotal + shipping)}</b>
              </div>
              <Button className="w-full" onClick={checkout} disabled={busy}>
                {busy ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <>
                    Continue to checkout
                    <ArrowRight size={17} />
                  </>
                )}
              </Button>
              <p className="secure-caption">
                <LockKeyhole size={12} />
                {config.demo
                  ? "Demo checkout · no payment charged"
                  : "Safe & secure payment with Paystack"}
              </p>
            </div>
          </>
        ) : (
          <div className="empty-bag">
            <div className="empty-icon">
              <ShoppingBag size={37} strokeWidth={1.2} />
            </div>
            <h3>Your next good find is waiting.</h3>
            <p>Fill your bag with things you'll love using every day.</p>
            <Button
              onClick={() => {
                setBagOpen(false);
                router.push("/shop");
              }}
            >
              Explore the store <ArrowRight size={17} />
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
