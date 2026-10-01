"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, Suspense } from "react";
import * as Dropdown from "@radix-ui/react-dropdown-menu";
import {
  ArrowUpRight,
  ChevronDown,
  Heart,
  MapPin,
  Menu,
  Search,
  SlidersHorizontal,
  ShoppingBag,
  UserRound,
  Zap,
  Leaf,
} from "lucide-react";
import { useStore } from "./store-provider";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "./ui/sheet";
import { CATEGORIES } from "@/lib/catalog-data";
import { NIGERIAN_STATES, cn } from "@/lib/utils";
import { SearchTrigger, ThemeToggle } from "./shopping-tools";
export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link
      href="/"
      aria-label="Kora home"
      className={cn("logo", light && "text-white")}
    >
      kora<span>.</span>
    </Link>
  );
}
function SearchBox() {
  return <SearchTrigger />;
}
export function SiteHeader() {
  const {
    count,
    setBagOpen,
    wishlist,
    user,
    config,
    deliveryState,
    setDeliveryState,
    setCompareOpen,
    setSearchOpen,
  } = useStore();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <>
      <div className="announcement">
        <div className="page-width announcement-inner">
          <span className="announcement-left">
            <Leaf size={13} /> Good finds. Better living.
          </span>
          <span>
            Free delivery on orders over <b>₦100,000</b>{" "}
          </span>
          <span className="announcement-right">
            {config.demo
              ? "DEMO STORE · NO REAL CHARGES"
              : "Picked with care. Delivered nationwide."}
          </span>
        </div>
      </div>
      <header className="site-header">
        <div className="page-width main-header">
          <button
            className="icon-button mobile-menu"
            onClick={() => setMenuOpen(true)}
            aria-label="Open navigation menu"
          >
            <Menu size={23} />
          </button>
          <Logo />
          <div className="desktop-search">
            <Suspense>
              <SearchBox />
            </Suspense>
          </div>
          <div className="header-tools">
            <button
              className="icon-button mobile-search-launcher"
              aria-label="Open product search"
              onClick={() => setSearchOpen(true)}
            >
              <Search size={21} />
            </button>
            <button
              className="icon-button header-compare"
              aria-label="Open product comparison"
              onClick={() => setCompareOpen(true)}
            >
              <SlidersHorizontal size={20} />
            </button>
            <ThemeToggle />
          </div>
          <Dropdown.Root>
            <Dropdown.Trigger className="delivery-selector">
              <MapPin size={20} />
              <span>
                <small>Deliver to</small>
                <b>
                  {deliveryState}, Nigeria <ChevronDown size={12} />
                </b>
              </span>
            </Dropdown.Trigger>
            <Dropdown.Portal>
              <Dropdown.Content
                className="dropdown-content"
                align="end"
                sideOffset={12}
              >
                <Dropdown.Label className="px-3 pb-2 text-xs text-subtle">
                  CHOOSE YOUR DELIVERY STATE
                </Dropdown.Label>
                {NIGERIAN_STATES.map((state) => (
                  <Dropdown.Item
                    key={state}
                    className="dropdown-item"
                    onSelect={() => setDeliveryState(state)}
                  >
                    {state}
                    {state === deliveryState && (
                      <span className="ml-auto text-primary">✓</span>
                    )}
                  </Dropdown.Item>
                ))}
              </Dropdown.Content>
            </Dropdown.Portal>
          </Dropdown.Root>
          <div className="header-actions">
            <Link
              href="/account"
              className="icon-button"
              aria-label={
                user ? `${user.name}'s account` : "Sign in or view account"
              }
            >
              {user ? (
                <span className="avatar-initial">
                  {user.name[0].toUpperCase()}
                </span>
              ) : (
                <UserRound size={22} />
              )}
            </Link>
            <Link
              href="/wishlist"
              className="icon-button wishlist-header"
              aria-label={`Wishlist, ${wishlist.length} saved items`}
            >
              <Heart size={22} />
              {wishlist.length > 0 && <span className="small-dot" />}
            </Link>
            <div className="header-divider" />
            <button
              className="icon-button bag-button"
              onClick={() => setBagOpen(true)}
              aria-label={`Open shopping bag, ${count} items`}
            >
              <ShoppingBag size={22} />
              <span className="bag-count">{count}</span>
            </button>
          </div>
        </div>
        <nav className="page-width desktop-nav" aria-label="Main navigation">
          <div className="main-nav-links">
            <Link href="/shop" className={cn(pathname === "/shop" && "active")}>
              Shop all <ChevronDown size={12} />
            </Link>
            <Link href="/shop?collection=new">
              New arrivals <span className="nav-dot" />
            </Link>
            <Link href="/shop?collection=bestsellers">Best sellers</Link>
            {CATEGORIES.slice(1).map((c) => (
              <Link key={c} href={`/shop?category=${encodeURIComponent(c)}`}>
                {c}
              </Link>
            ))}
          </div>
          <Link href="/shop?collection=deals" className="deals-nav">
            <Zap size={15} /> Daily deals
          </Link>
        </nav>
        <div className="mobile-search page-width">
          <Suspense>
            <SearchBox />
          </Suspense>
        </div>
      </header>
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left">
          <SheetTitle className="logo p-7">
            kora<span>.</span>
          </SheetTitle>
          <SheetDescription className="px-7 text-sm text-subtle">
            A little upgrade for your everyday.
          </SheetDescription>
          <nav className="mobile-nav">
            {[
              ["Shop all", "/shop"],
              ["New arrivals", "/shop?collection=new"],
              ["Best sellers", "/shop?collection=bestsellers"],
              ["Daily deals", "/shop?collection=deals"],
              ...CATEGORIES.slice(1).map((c) => [
                c,
                `/shop?category=${encodeURIComponent(c)}`,
              ]),
              ["Your account", "/account"],
              ["Your favourites", "/wishlist"],
              ["Help & FAQs", "/help"],
            ].map(([label, href]) => (
              <Link key={label} href={href} onClick={() => setMenuOpen(false)}>
                {label}
                <ArrowUpRight size={17} />
              </Link>
            ))}
          </nav>
        </SheetContent>
      </Sheet>
    </>
  );
}
