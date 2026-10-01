"use client";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { SessionProvider, signIn, signOut, useSession } from "next-auth/react";
import { MotionConfig } from "framer-motion";
import { Toaster, toast } from "sonner";
import type { Product, CartLine, StoreConfig, Receipt } from "@/lib/types";
import { effectivePrice, mergeCartLines, NIGERIAN_STATES } from "@/lib/utils";
import { cartStorageKey, validCartLines, rebaseCartLines } from "@/lib/cart-storage";
import { readDemoReviews, summarizeReviews } from "@/lib/reviews";
import { knownProductIds } from "@/lib/catalog-tools";
import { ThemeProvider } from "next-themes";
type DemoUser = { id: string; name: string; email: string };
type Store = {
  products: Product[];
  config: StoreConfig;
  items: CartLine[];
  hydrated: boolean;
  cartReady: boolean;
  cartError: string;
  count: number;
  subtotal: number;
  wishlist: string[];
  bagOpen: boolean;
  setBagOpen: (v: boolean) => void;
  quickView: Product | null;
  setQuickView: (v: Product | null) => void;
  addItem: (id: string, quantity?: number) => void;
  setQuantity: (id: string, quantity: number) => void;
  removeItem: (id: string) => void;
  toggleWishlist: (id: string) => void;
  user: DemoUser | null;
  demoSignIn: (name: string, email: string) => void;
  logout: () => Promise<void>;
  googleSignIn: () => Promise<void>;
  flushCart: () => Promise<void>;
  refreshCart: () => Promise<void>;
  completeDemoOrder: (receipt: Receipt) => void;
  orders: Receipt[];
  deliveryState: string;
  setDeliveryState: (v: string) => void;
  compare: string[];
  toggleCompare: (id: string) => void;
  clearCompare: () => void;
  compareOpen: boolean;
  setCompareOpen: (open: boolean) => void;
  recent: string[];
  rememberProduct: (id: string) => void;
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
  repeatOrder: (receipt: Receipt) => void;
};
const StoreContext = createContext<Store | null>(null);
export function useStore() {
  const context = useContext(StoreContext);
  if (!context) throw new Error("StoreProvider missing");
  return context;
}
const parseStorage = <T,>(key: string, fallback: T): T => {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
};
const readStorage = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const validDemoUser = (value: DemoUser | null) =>
  value &&
  typeof value.id === "string" &&
  typeof value.name === "string" &&
  typeof value.email === "string"
    ? value
    : null;
function StoreState({
  products,
  config,
  children,
}: {
  products: Product[];
  config: StoreConfig;
  children: ReactNode;
}) {
  const { data: session, status } = useSession();
  const [items, setItems] = useState<CartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [cartReady, setCartReady] = useState(false);
  const [cartError, setCartError] = useState("");
  const [syncRetry, setSyncRetry] = useState(0);
  const [demoReviews, setDemoReviews] = useState<import("@/lib/types").Review[]>([]);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [bagOpen, setBagOpen] = useState(false);
  const [quickView, setQuickView] = useState<Product | null>(null);
  const [demoUser, setDemoUser] = useState<DemoUser | null>(null);
  const [orders, setOrders] = useState<Receipt[]>([]);
  const [deliveryState, setDeliveryState] = useState("Lagos");
  const [compare, setCompare] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [priceRevision, setPriceRevision] = useState(0);
  const compareRef = useRef(compare);
  compareRef.current = compare;
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const revision = useRef(0);
  const lastSynced = useRef("[]");
  const ready = useRef(false);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const bagScope = useRef(cartStorageKey(config.demo));
  const authChanging = useRef(false);
  const syncOwner = useRef<string | null>(null);
  const sessionOwner = useRef<string | null>(null);
  sessionOwner.current = session?.user?.id ?? null;
  const initialized = useRef(false);
  function readBag(key: string) {
    return validCartLines(
      parseStorage<unknown>(key, []),
      new Set(products.map((p) => p.id)),
    );
  }
  function storeBag(key: string, lines: CartLine[]) {
    try {
      localStorage.setItem(key, JSON.stringify(lines));
    } catch {}
  }
  function forgetBag(key: string) {
    try {
      localStorage.removeItem(key);
    } catch {}
  }
  const user = config.demo
    ? demoUser
    : session?.user
      ? {
          id: session.user.id,
          name: session.user.name || "Customer",
          email: session.user.email || "",
        }
      : null;
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const available = new Set(products.map((p) => p.id));
    const savedUser = config.demo
      ? parseStorage<DemoUser | null>("kora-demo-user-v1", null)
      : null;
    const validUser = validDemoUser(savedUser);
    bagScope.current = cartStorageKey(config.demo, validUser?.id);
    // The old shared cache has no guest/account provenance. Migrate it only
    // when a demo account is present, never expose it to a logged-out visitor.
    if (config.demo && validUser && !readStorage(bagScope.current))
      storeBag(
        bagScope.current,
        validCartLines(parseStorage<unknown>("kora-bag-v1", []), available),
      );
    const valid = config.demo ? readBag(bagScope.current) : [];
    setItems(valid);
    itemsRef.current = valid;
    const saved = parseStorage<string[]>("kora-wishlist-v1", []);
    setWishlist(
      Array.isArray(saved) ? saved.filter((i) => available.has(i)) : [],
    );
    setDemoUser(validUser);
    setOrders(parseStorage<Receipt[]>("kora-demo-orders-v1", []));
    const savedState = readStorage("kora-delivery-state");
    setDeliveryState(
      NIGERIAN_STATES.some((state) => state === savedState)
        ? savedState!
        : "Lagos",
    );
    setCompare(
      knownProductIds(
        parseStorage<unknown>("kora-compare-v1", []),
        products,
        3,
      ),
    );
    setRecent(
      knownProductIds(parseStorage<unknown>("kora-recent-v1", []), products, 6),
    );
    if (config.demo) setDemoReviews(readDemoReviews());
    setHydrated(true);
    setCartReady(config.demo);
    ready.current = config.demo;
  }, [products]);
  useEffect(() => {
    const future = products
      .filter((p) => p.isDailyDeal && p.dealEndsAt)
      .map((p) => new Date(p.dealEndsAt!).getTime())
      .filter((time) => time > Date.now());
    if (!future.length) return;
    const timer = window.setTimeout(
      () => setPriceRevision((current) => current + 1),
      Math.min(2147483647, Math.max(1, Math.min(...future) - Date.now() + 20)),
    );
    return () => window.clearTimeout(timer);
  }, [products, priceRevision]);
  const fetchCart = useCallback(async () => {
    const response = await fetch("/api/cart", { cache: "no-store", signal: AbortSignal.timeout(15000) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Couldn't sync your bag.");
    return data as {
      items: CartLine[];
      revision: number;
      created: boolean;
      ownerId: string | null;
    };
  }, []);
  const flushCart = useCallback(async () => {
    if (config.demo) return;
    queue.current = queue.current
      .catch(() => {})
      .then(async () => {
        if (!ready.current)
          throw new Error(
            "Your bag is still syncing. Please try again in a moment.",
          );
        for (let pass = 0; pass < 20; pass++) {
          if (!ready.current || syncOwner.current !== sessionOwner.current)
            throw new Error(
              "Your sign-in changed. Refresh your bag before making changes.",
            );
          const snapshot = JSON.stringify(itemsRef.current);
          if (snapshot === lastSynced.current) return;
          const response = await fetch("/api/cart", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              items: JSON.parse(snapshot),
              revision: revision.current,
              ownerId: syncOwner.current,
            }),
            signal: AbortSignal.timeout(15000),
          });
          const data = await response.json();
          if (!response.ok) {
            if (response.status === 409 && data.fields?.revision === "conflict") {
              const latest = await fetchCart();
              if (latest.ownerId !== sessionOwner.current) {
                ready.current = false;
                setCartReady(false);
                throw new Error(
                  "Your sign-in changed. Please refresh the page.",
                );
              }
              const rebased = rebaseCartLines(JSON.parse(lastSynced.current), itemsRef.current, latest.items);
              revision.current = latest.revision;
              lastSynced.current = JSON.stringify(latest.items);
              itemsRef.current = rebased;
              setItems(rebased);
              continue;
            }
            throw new Error(
              data.error || "Couldn't save your bag. Please try again.",
            );
          }
          revision.current = data.revision;
          lastSynced.current = snapshot;
        }
        throw new Error("Your bag is changing on another device. Please try again in a moment.");
      });
    return queue.current;
  }, [config.demo, fetchCart]);
  useEffect(() => {
    if (config.demo || !hydrated || status === "loading") return;
    let cancelled = false;
    ready.current = false;
    setCartReady(false);
    setCartError("");
    bagScope.current = cartStorageKey(false, session?.user?.id);
    const guestCache = !session?.user ? readBag(bagScope.current) : [];
    itemsRef.current = guestCache;
    setItems(guestCache);
    void queue.current
      .catch(() => {})
      .then(fetchCart)
      .then(async (data) => {
        if (cancelled) return;
        if (data.ownerId !== sessionOwner.current)
          throw new Error("Your sign-in changed. Please refresh the page.");
        syncOwner.current = data.ownerId;
        revision.current = data.revision;
        lastSynced.current = JSON.stringify(data.items);
        ready.current = true;
        if (data.created && !session?.user && itemsRef.current.length)
          await flushCart();
        else {
          itemsRef.current = data.items;
          setItems(data.items);
        }
        if (data.ownerId) {
          storeBag(cartStorageKey(false), []);
          forgetBag(bagScope.current);
        }
        setCartReady(true);
      })
      .catch((e) => {
        if (!cancelled) {
          ready.current = false;
          setCartError("Your shopping bag couldn't sync. Check your connection and try again.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [config.demo, hydrated, status, session?.user?.id, fetchCart, flushCart, syncRetry]);
  useEffect(() => {
    if (!config.demo) return;
    const refresh = () => setDemoReviews(readDemoReviews());
    const storage = (event: StorageEvent) => { if (event.key === "kora-demo-reviews-v1") refresh(); };
    window.addEventListener("kora-reviews-updated", refresh);
    window.addEventListener("storage", storage);
    return () => { window.removeEventListener("kora-reviews-updated", refresh); window.removeEventListener("storage", storage); };
  }, [config.demo]);
  useEffect(() => {
    if (!config.demo) return;
    const refresh = () => setOrders(parseStorage<Receipt[]>("kora-demo-orders-v1", []));
    const storage = (event: StorageEvent) => { if (event.key === "kora-demo-orders-v1") refresh(); };
    window.addEventListener("kora-orders-updated", refresh);
    window.addEventListener("storage", storage);
    return () => { window.removeEventListener("kora-orders-updated", refresh); window.removeEventListener("storage", storage); };
  }, [config.demo]);
  useEffect(() => {
    if (config.demo || !hydrated || status === "loading") return;
    let active = true, running = false;
    const sync = async () => {
      if (!active || running || document.visibilityState !== "visible" || authChanging.current) return;
      if (!ready.current) { setSyncRetry(value => value + 1); return; }
      running = true;
      try {
        await flushCart();
        queue.current = queue.current.catch(() => {}).then(async () => {
          if (!active || !ready.current || syncOwner.current !== sessionOwner.current) return;
          const data = await fetchCart();
          if (!active || data.ownerId !== sessionOwner.current || syncOwner.current !== sessionOwner.current) return;
          const next = rebaseCartLines(JSON.parse(lastSynced.current), itemsRef.current, data.items);
          revision.current = data.revision;
          lastSynced.current = JSON.stringify(data.items);
          itemsRef.current = next;
          setItems(next);
          setCartError("");
        });
        await queue.current;
      } catch (e) { if (active) setCartError(e instanceof Error ? e.message : "Your bag changes couldn't sync. Your selections remain on this page. Please retry."); }
      finally { running = false; }
    };
    const timer = window.setInterval(() => void sync(), 20000);
    const listener = () => void sync();
    window.addEventListener("focus", listener);
    window.addEventListener("online", listener);
    document.addEventListener("visibilitychange", listener);
    return () => {
      active = false; window.clearInterval(timer);
      window.removeEventListener("focus", listener); window.removeEventListener("online", listener); document.removeEventListener("visibilitychange", listener);
    };
  }, [config.demo, hydrated, status, session?.user?.id, fetchCart, flushCart]);
  useEffect(() => {
    if (!hydrated || !cartReady) return;
    // Live account carts stay on the server; only guests need a local backup.
    if (config.demo || !syncOwner.current) storeBag(bagScope.current, items);
    if (!config.demo && ready.current) {
      const timer = window.setTimeout(() => {
        void flushCart().catch((e) => toast.error(e.message));
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [items, hydrated, cartReady, config.demo, flushCart]);
  useEffect(() => {
    if (hydrated) {
      try {
        localStorage.setItem("kora-wishlist-v1", JSON.stringify(wishlist));
        localStorage.setItem("kora-delivery-state", deliveryState);
        localStorage.setItem("kora-compare-v1", JSON.stringify(compare));
        localStorage.setItem("kora-recent-v1", JSON.stringify(recent));
      } catch {}
    }
  }, [wishlist, deliveryState, compare, recent, hydrated]);
  useEffect(() => {
    const listener = (event: StorageEvent) => {
      if (!config.demo) return;
      if (event.key === "kora-demo-user-v1") {
        const nextUser = validDemoUser(
          parseStorage<DemoUser | null>("kora-demo-user-v1", null),
        );
        bagScope.current = cartStorageKey(true, nextUser?.id);
        const next = readBag(bagScope.current);
        itemsRef.current = next;
        setItems(next);
        setDemoUser(nextUser);
      } else if (event.key === bagScope.current) {
        const next = readBag(bagScope.current);
        itemsRef.current = next;
        setItems(next);
      }
    };
    window.addEventListener("storage", listener);
    return () => window.removeEventListener("storage", listener);
  }, [config.demo]);
  function setQuantity(id: string, quantity: number) {
    if (!ready.current || authChanging.current) {
      toast.info(
        "Your shopping bag is still syncing. Please try again in a moment.",
      );
      return;
    }
    const product = products.find((p) => p.id === id);
    if (!product) return;
    const max = Math.min(99, Math.max(0, product.stock - product.reserved));
    if (quantity > max) {
      toast.info(`Only ${max} available right now.`);
      return;
    }
    const current = itemsRef.current;
    const next =
      quantity <= 0
        ? current.filter((i) => i.productId !== id)
        : current.some((i) => i.productId === id)
          ? current.map((i) => (i.productId === id ? { ...i, quantity } : i))
          : [...current, { productId: id, quantity }];
    itemsRef.current = next;
    setItems(next);
  }
  function addItem(id: string, quantity = 1) {
    if (!ready.current || authChanging.current) {
      toast.info("Your bag is still syncing. Please try again in a moment.");
      return;
    }
    const product = products.find((p) => p.id === id);
    if (!product || product.stock - product.reserved <= 0) return;
    const next =
      (itemsRef.current.find((i) => i.productId === id)?.quantity || 0) +
      quantity;
    if (next > Math.min(99, product.stock - product.reserved)) {
      toast.info("You've reached the available quantity.");
      return;
    }
    setQuantity(id, next);
    toast.success("A good find, added to your bag.", {
      id: "kora-bag-added",
      description: product.title,
      action: { label: "View bag", onClick: () => setBagOpen(true) },
    });
  }
  function demoSignIn(name: string, email: string) {
    const next = {
      id: email.trim().toLowerCase(),
      name: name.trim() || "Kora customer",
      email: email.trim().toLowerCase(),
    };
    storeBag(bagScope.current, itemsRef.current);
    const guestKey = cartStorageKey(true);
    const accountKey = cartStorageKey(true, next.id);
    const incoming = demoUser ? [] : itemsRef.current;
    const merged = mergeCartLines(readBag(accountKey), incoming)
      .map((line) => ({
        ...line,
        quantity: Math.min(
          line.quantity,
          Math.max(
            0,
            (products.find((p) => p.id === line.productId)?.stock || 0) -
              (products.find((p) => p.id === line.productId)?.reserved || 0),
          ),
        ),
      }))
      .filter((line) => line.quantity > 0);
    storeBag(accountKey, merged);
    storeBag(guestKey, []);
    bagScope.current = accountKey;
    itemsRef.current = merged;
    setItems(merged);
    setDemoUser(next);
    try {
      localStorage.setItem("kora-demo-user-v1", JSON.stringify(next));
    } catch {}
    toast.success(`Welcome, ${next.name.split(" ")[0]}.`);
  }
  async function logout() {
    if (config.demo) {
      storeBag(bagScope.current, itemsRef.current);
      bagScope.current = cartStorageKey(true);
      storeBag(bagScope.current, []);
      itemsRef.current = [];
      setItems([]);
      setDemoUser(null);
      try {
        localStorage.removeItem("kora-demo-user-v1");
      } catch {}
      toast.success(
        "Signed out. Your account bag is saved for your next sign-in.",
      );
      return;
    }
    authChanging.current = true;
    try {
      await flushCart();
      const response = await fetch("/api/cart/retain", { method: "POST" });
      if (!response.ok)
        throw new Error("We couldn't finish signing out. Please try again.");
      forgetBag(bagScope.current);
      ready.current = false;
      setCartReady(false);
      bagScope.current = cartStorageKey(false);
      storeBag(bagScope.current, []);
      itemsRef.current = [];
      setItems([]);
      await signOut({ callbackUrl: "/" });
    } finally {
      authChanging.current = false;
    }
  }
  async function googleSignIn() {
    await flushCart();
    await signIn("google", {
      callbackUrl: (() => {
        const next = new URLSearchParams(window.location.search).get("next");
        return next?.startsWith("/") && !next.startsWith("//")
          ? next
          : window.location.pathname;
      })(),
    });
  }
  async function refreshCart() {
    if (config.demo) return;
    const data = await fetchCart();
    if (data.ownerId !== sessionOwner.current)
      throw new Error("Your sign-in changed. Please refresh the page.");
    revision.current = data.revision;
    lastSynced.current = JSON.stringify(data.items);
    itemsRef.current = data.items;
    setItems(data.items);
  }
  function completeDemoOrder(receipt: Receipt) {
    const saved = { ...receipt, demo: true, customerId: user?.id ?? "guest" };
    const next = [
      saved,
      ...parseStorage<Receipt[]>("kora-demo-orders-v1", []).filter(
        (o) => o.id !== receipt.id,
      ),
    ];
    localStorage.setItem("kora-demo-orders-v1", JSON.stringify(next));
    setOrders(next);
    const remaining = itemsRef.current
      .map((line) => ({
        ...line,
        quantity:
          line.quantity -
          (receipt.items.find((i) => i.productId === line.productId)
            ?.quantity || 0),
      }))
      .filter((i) => i.quantity > 0);
    itemsRef.current = remaining;
    setItems(remaining);
  }
  function toggleCompare(id: string) {
    if (!products.some((p) => p.id === id)) return;
    const current = compareRef.current;
    if (!current.includes(id) && current.length >= 3) {
      toast.info("Compare up to 3 products. Remove one to add another.");
      return;
    }
    const next = current.includes(id)
      ? current.filter((item) => item !== id)
      : [...current, id];
    compareRef.current = next;
    setCompare(next);
  }
  function repeatOrder(receipt: Receipt) {
    if (!ready.current || authChanging.current) {
      toast.info("Your bag is still syncing.");
      return;
    }
    const additions = receipt.items
      .map((line) => {
        const product = products.find((p) => p.id === line.productId);
        return {
          productId: line.productId,
          quantity: product
            ? Math.min(
                line.quantity,
                Math.max(
                  0,
                  product.stock -
                    product.reserved -
                    (itemsRef.current.find(
                      (i) => i.productId === line.productId,
                    )?.quantity || 0),
                ),
                99 -
                  (itemsRef.current.find((i) => i.productId === line.productId)
                    ?.quantity || 0),
              )
            : 0,
        };
      })
      .filter((line) => line.quantity > 0);
    if (!additions.length) {
      toast.info(
        "Those items are unavailable or already at their limit in your bag.",
      );
      return;
    }
    const next = mergeCartLines(itemsRef.current, additions);
    itemsRef.current = next;
    setItems(next);
    setBagOpen(true);
    toast.success("Available items added at today's prices.", {
      id: "kora-bag-added",
    });
  }
  const rememberProduct = useCallback(
    (id: string) =>
      setRecent((current) =>
        current[0] === id
          ? current
          : [id, ...current.filter((item) => item !== id)].slice(0, 6),
      ),
    [],
  );
  const activeScope = cartStorageKey(config.demo, user?.id);
  const visibleItems = (
    config.demo ||
    (cartReady && status !== "loading" && bagScope.current === activeScope)
      ? items
      : []
  ).filter((line) => products.some((p) => p.id === line.productId));
  const value: Store = {
    products: config.demo ? products.map(product => {
      const summary = summarizeReviews(demoReviews.filter(review => review.productId === product.id));
      return { ...product, rating: String(summary.average), reviewCount: summary.count };
    }) : products,
    config,
    items: visibleItems,
    hydrated: hydrated && (config.demo || status !== "loading"),
    cartReady,
    cartError,
    count: visibleItems.reduce((sum, i) => sum + i.quantity, 0),
    subtotal: visibleItems.reduce(
      (sum, i) =>
        sum +
        effectivePrice(products.find((p) => p.id === i.productId)!) *
          i.quantity,
      0,
    ),
    wishlist,
    bagOpen,
    setBagOpen,
    quickView,
    setQuickView,
    addItem,
    setQuantity,
    removeItem: (id) => setQuantity(id, 0),
    toggleWishlist: (id) =>
      setWishlist((current) =>
        current.includes(id)
          ? current.filter((i) => i !== id)
          : [...current, id],
      ),
    user,
    demoSignIn,
    logout,
    googleSignIn,
    flushCart,
    refreshCart,
    completeDemoOrder,
    orders,
    deliveryState,
    setDeliveryState,
    compare,
    toggleCompare,
    clearCompare: () => {
      compareRef.current = [];
      setCompare([]);
    },
    compareOpen,
    setCompareOpen,
    recent,
    rememberProduct,
    searchOpen,
    setSearchOpen,
    repeatOrder,
  };
  return (
    <StoreContext.Provider value={value}>
      <StoreBrowserTools />
      {cartError && <div className="cart-sync-notice" role="alert">
        <span>{cartError}</span>
        <button type="button" onClick={() => { if (ready.current) window.dispatchEvent(new Event("online")); else setSyncRetry(value => value + 1); }}>Retry bag sync</button>
      </div>}
      {children}
    </StoreContext.Provider>
  );
}
function StoreBrowserTools() {
  const { items, products, subtotal, count, hydrated } = useStore();
  const current = useRef({ items, products, subtotal, count, hydrated });
  current.current = { items, products, subtotal, count, hydrated };
  useEffect(() => {
    const context = (
      document as Document & {
        modelContext?: {
          registerTool(
            tool: {
              name: string;
              title: string;
              description: string;
              inputSchema: object;
              annotations: {
                readOnlyHint: boolean;
                untrustedContentHint: boolean;
              };
              execute: (input: unknown) => unknown;
            },
            options: { signal: AbortSignal },
          ): void | Promise<void>;
        };
      }
    ).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    try {
      void Promise.resolve(
        context.registerTool(
          {
            name: "read_shopping_bag",
            title: "Read shopping bag",
            description:
              "Read the current shopping bag, quantities and subtotal in Nigerian Naira without changing it. Delivery fees are calculated at checkout.",
            inputSchema: {
              type: "object",
              properties: {},
              additionalProperties: false,
            },
            annotations: { readOnlyHint: true, untrustedContentHint: true },
            execute(input) {
              if (
                !input ||
                typeof input !== "object" ||
                Array.isArray(input) ||
                Object.keys(input).length
              )
                throw new Error("Expected an empty object.");
              const bag = current.current;
              if (!bag.hydrated)
                throw new Error("The shopping bag is still loading.");
              return {
                currency: "NGN",
                count: bag.count,
                subtotalNaira: bag.subtotal,
                items: bag.items.map((line) => {
                  const product = bag.products.find(
                    (p) => p.id === line.productId,
                  )!;
                  return {
                    productId: product.id,
                    title: product.title,
                    quantity: line.quantity,
                    unitPriceNaira: effectivePrice(product),
                  };
                }),
              };
            },
          },
          { signal: lifecycle.signal },
        ),
      ).catch(() => {});
    } catch {
      lifecycle.abort();
    }
    return () => lifecycle.abort();
  }, []);
  return null;
}
export function StoreProvider(props: {
  products: Product[];
  config: StoreConfig;
  children: ReactNode;
}) {
  return (
    <ThemeProvider
      attribute="data-theme"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
    >
      <SessionProvider refetchOnWindowFocus>
        <MotionConfig reducedMotion="user">
          <StoreState {...props} />
          <Toaster
            position="top-center"
            richColors
            closeButton
            toastOptions={{ style: { fontFamily: "DM Sans, sans-serif" } }}
          />
        </MotionConfig>
      </SessionProvider>
    </ThemeProvider>
  );
}
