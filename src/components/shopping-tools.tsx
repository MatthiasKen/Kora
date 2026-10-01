"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Command } from "cmdk";
import { useTheme } from "next-themes";
import {
  Check,
  Clock3,
  Moon,
  Search,
  SlidersHorizontal,
  Sun,
  WifiOff,
  X,
} from "lucide-react";
import { useStore } from "./store-provider";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { CATEGORIES } from "@/lib/catalog-data";
import { productMatches } from "@/lib/catalog-tools";
import { effectivePrice, money, percentOff } from "@/lib/utils";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const dark = mounted && resolvedTheme === "dark";
  return (
    <button
      type="button"
      className="icon-button theme-toggle"
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Light mode" : "Dark mode"}
      onClick={() => setTheme(dark ? "light" : "dark")}
    >
      {dark ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  );
}
export function SearchTrigger() {
  const { setSearchOpen } = useStore();
  return (
    <button
      type="button"
      className="search-launcher"
      onClick={() => setSearchOpen(true)}
      aria-label="Open product search"
    >
      <Search size={18} />
      <span>Search your next upgrade</span>
      <kbd>⌘ K</kbd>
    </button>
  );
}
function SearchPalette() {
  const { products, recent, searchOpen, setSearchOpen } = useStore();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", shortcut);
    try {
      const saved = JSON.parse(
        localStorage.getItem("kora-searches-v1") || "[]",
      );
      if (Array.isArray(saved))
        setHistory(
          saved
            .filter((v) => typeof v === "string" && v.length <= 80)
            .slice(0, 4),
        );
    } catch {}
    return () => window.removeEventListener("keydown", shortcut);
  }, [setSearchOpen]);
  useEffect(() => {
    if (searchOpen) setQuery("");
  }, [searchOpen]);
  function go(path: string, term?: string) {
    if (term?.trim()) {
      const next = [
        term.trim().slice(0, 80),
        ...history.filter((item) => item !== term.trim()),
      ].slice(0, 4);
      setHistory(next);
      try {
        localStorage.setItem("kora-searches-v1", JSON.stringify(next));
      } catch {}
    }
    setSearchOpen(false);
    router.push(path);
  }
  const matches = products.filter((p) => productMatches(p, query));
  const suggestions = query
    ? matches.slice(0, 6)
    : [
        ...recent
          .map((id) => products.find((p) => p.id === id))
          .filter((p) => !!p),
        ...products.filter((p) => p.isBestSeller),
      ]
        .filter((p, i, all) => all.findIndex((item) => item.id === p.id) === i)
        .slice(0, 6);
  return (
    <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
      <DialogContent className="search-palette">
        <DialogTitle className="sr-only">Find your next upgrade</DialogTitle>
        <DialogDescription className="sr-only">
          Search products and categories. Use the arrow keys to choose a result.
        </DialogDescription>
        <Command shouldFilter={false} loop>
          <div className="command-search-input">
            <Search size={21} />
            <Command.Input
              aria-label="Search products"
              placeholder="Search products…"
              value={query}
              onValueChange={setQuery}
              maxLength={80}
            />
            <kbd>ESC</kbd>
            <DialogClose
              className="command-close"
              aria-label="Close product search"
            >
              <X size={19} />
            </DialogClose>
          </div>
          <Command.List>
            {query && (
              <Command.Item
                value="all-results"
                onSelect={() =>
                  go(`/shop?q=${encodeURIComponent(query.trim())}`, query)
                }
                className="command-all-results"
              >
                <Search size={17} />
                See all {matches.length} results for “{query}”
              </Command.Item>
            )}
            {!query && history.length > 0 && (
              <Command.Group heading="Recent searches">
                {history.map((term) => (
                  <Command.Item
                    key={term}
                    value={`search:${term}`}
                    onSelect={() =>
                      go(`/shop?q=${encodeURIComponent(term)}`, term)
                    }
                  >
                    <Clock3 size={16} />
                    {term}
                  </Command.Item>
                ))}
              </Command.Group>
            )}
            <Command.Group
              heading={
                query
                  ? "Products"
                  : recent.length
                    ? "Recently viewed & popular"
                    : "Popular right now"
              }
            >
              {suggestions.map((p) => (
                <Command.Item
                  key={p.id}
                  value={`product:${p.id}`}
                  onSelect={() => go(`/product/${p.slug}`, query || p.title)}
                >
                  <Image src={p.imageUrl} alt="" width={44} height={44} />
                  <span>
                    <b>{p.title}</b>
                    <small>{p.category}</small>
                  </span>
                  <strong>{money(effectivePrice(p))}</strong>
                </Command.Item>
              ))}
            </Command.Group>
            {!matches.length && (
              <p className="command-no-results">
                No products match yet. Try “headphones”, “home”, or “watch”.
              </p>
            )}
            <Command.Group heading="Collections">
              {CATEGORIES.slice(1)
                .filter(
                  (category) =>
                    !query ||
                    category.toLowerCase().includes(query.toLowerCase()),
                )
                .map((category) => (
                  <Command.Item
                    key={category}
                    value={`category:${category}`}
                    onSelect={() =>
                      go(`/shop?category=${encodeURIComponent(category)}`)
                    }
                  >
                    <SlidersHorizontal size={16} />
                    {category}
                  </Command.Item>
                ))}
            </Command.Group>
          </Command.List>
          <div className="command-footer">
            <span>
              <kbd>↑ ↓</kbd> to explore
            </span>
            <span>
              <kbd>↵</kbd> to open
            </span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
function Comparison() {
  const {
    config,
    compare,
    products,
    compareOpen,
    setCompareOpen,
    toggleCompare,
    clearCompare,
    addItem,
  } = useStore();
  const selected = compare
    .map((id) => products.find((p) => p.id === id))
    .filter((p) => !!p);
  return (
    <>
      <Dialog open={compareOpen} onOpenChange={setCompareOpen}>
        <DialogContent className="compare-dialog">
          <DialogTitle>Find the one that fits.</DialogTitle>
          <DialogDescription>
            Compare prices, availability and features side by side.
          </DialogDescription>
          {selected.length ? (
            <div className="compare-scroll">
              <table className="compare-table">
                <thead>
                  <tr>
                    <th scope="col">Your shortlist</th>
                    {selected.map((p) => (
                      <th key={p.id} scope="col">
                        <button
                          className="compare-remove"
                          onClick={() => toggleCompare(p.id)}
                          aria-label={`Remove ${p.title} from comparison`}
                        >
                          <X size={16} />
                        </button>
                        <Image
                          src={p.imageUrl}
                          alt={p.title}
                          width={140}
                          height={140}
                        />
                        <Link
                          href={`/product/${p.slug}`}
                          onClick={() => setCompareOpen(false)}
                        >
                          {p.title}
                        </Link>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">Price</th>
                    {selected.map((p) => (
                      <td key={p.id}>
                        <strong>{money(effectivePrice(p))}</strong>
                        {percentOff(effectivePrice(p), p.originalPriceNaira) >
                          0 && (
                          <small>
                            Save{" "}
                            {percentOff(
                              effectivePrice(p),
                              p.originalPriceNaira,
                            )}
                            %
                          </small>
                        )}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <th scope="row">Category</th>
                    {selected.map((p) => (
                      <td key={p.id}>{p.category}</td>
                    ))}
                  </tr>
                  <tr>
                    <th scope="row">Rating</th>
                    {selected.map((p) => (
                      <td key={p.id}>
                        {p.reviewCount ? (
                          <>
                            {p.rating} / 5
                            <small>
                              {p.reviewCount} {config.demo ? "demo " : ""}
                              {p.reviewCount === 1 ? "review" : "reviews"}
                            </small>
                          </>
                        ) : (
                          "No reviews yet"
                        )}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <th scope="row">Availability</th>
                    {selected.map((p) => (
                      <td key={p.id}>
                        {p.stock > p.reserved ? "In stock" : "Sold out"}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <th scope="row">Highlights</th>
                    {selected.map((p) => (
                      <td key={p.id}>
                        <ul>
                          {p.features.map((feature) => (
                            <li key={feature}>
                              <Check size={13} />
                              {feature}
                            </li>
                          ))}
                        </ul>
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <th scope="row">Make it yours</th>
                    {selected.map((p) => (
                      <td key={p.id}>
                        <Button
                          size="sm"
                          onClick={() => addItem(p.id)}
                          disabled={p.stock <= p.reserved}
                        >
                          Add to bag
                        </Button>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <div className="comparison-empty">
              <SlidersHorizontal size={32} />
              <h3>Your shortlist starts here.</h3>
              <p>
                Select up to 3 products using the compare button on each card.
              </p>
              <Button onClick={() => setCompareOpen(false)}>
                Keep exploring
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {selected.length > 0 && !compareOpen && (
        <div className="compare-bar">
          <div className="compare-mini-images">
            {selected.map((p) => (
              <Image
                key={p.id}
                src={p.imageUrl}
                alt=""
                width={36}
                height={36}
              />
            ))}
          </div>
          <span>
            {selected.length} selected
            <small>
              {selected.length < 2
                ? "Add one more to compare"
                : "Your next upgrade, side by side"}
            </small>
          </span>
          <Button
            size="sm"
            disabled={selected.length < 2}
            onClick={() => setCompareOpen(true)}
          >
            Compare
          </Button>
          <button aria-label="Clear comparison" onClick={clearCompare}>
            <X size={17} />
          </button>
        </div>
      )}
    </>
  );
}
function ConnectionNotice() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return offline ? (
    <div className="offline-notice" role="status">
      <WifiOff size={17} /> You're offline. Reconnect before checkout.
    </div>
  ) : null;
}
export function ShoppingTools() {
  return (
    <>
      <SearchPalette />
      <Comparison />
      <ConnectionNotice />
    </>
  );
}
