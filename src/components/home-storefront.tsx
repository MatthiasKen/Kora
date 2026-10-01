"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  CreditCard,
  Headphones,
  Leaf,
  PackageCheck,
  RotateCcw,
  ShieldCheck,
  ShoppingBag,
  Truck,
  Zap,
} from "lucide-react";
import { useStore } from "./store-provider";
import { ProductCard } from "./product-card";
import { RecentlyViewed } from "./recently-viewed";
import { Countdown } from "./countdown";
import { Button } from "./ui/button";
import { Spotlight } from "./ui/spotlight";
import { activeDeal, cn, effectivePrice, money } from "@/lib/utils";
const categories = [
  {
    title: "Electronics",
    subtitle: "Stay one step ahead.",
    image: "headphones",
  },
  { title: "Fashion", subtitle: "Find your everyday signature.", image: "bag" },
  { title: "Home & Living", subtitle: "Make room for better.", image: "home" },
  { title: "Beauty & Care", subtitle: "Your daily reset.", image: "serum" },
];
export function HomeStorefront() {
  const { products, addItem } = useStore();
  const [collection, setCollection] = useState("For you");
  const [now, setNow] = useState(0);
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const deals = products
    .filter((p) => activeDeal(p, now || Date.now()))
    .slice(0, 4);
  const featured = products
    .filter((p) =>
      collection === "New arrivals"
        ? p.isNewArrival
        : collection === "Best sellers"
          ? p.isBestSeller
          : true,
    )
    .slice(0, 8);
  const heroProduct =
    products.find((p) => p.slug === "studio-headphones") || products[0];
  return (
    <>
      <section
        className="page-width future-hero-wrap"
        aria-label="Discover Kora"
      >
        <div className="future-hero">
          <motion.div
            className="future-hero-copy"
            initial={{ opacity: 1, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="hero-release">
              <i />
              THE EVERYDAY UPGRADE
            </div>
            <h1>
              Good finds.
              <br />
              Great living.
              <br />
              <span>Your next era.</span>
            </h1>
            <p>
              Discover the tech, style and little essentials that make every day
              feel a little better. All in one place.
            </p>
            <div className="future-hero-ctas">
              <Button asChild>
                <Link href="/shop">Explore the collection</Link>
              </Button>
              <Link href="/shop?collection=deals" className="text-link">
                Today's best deals
              </Link>
            </div>
            <div className="hero-copy-foot">
              <span className="nigeria-flag" />
              Curated for you. Delivered across Nigeria.
            </div>
          </motion.div>
          <motion.div
            className="future-hero-media"
            initial={false}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7 }}
          >
            <Image
              src="/images/hero.webp"
              alt="A curated collection of headphones, a leather bag and home essentials on sculpted stone plinths"
              fill
              priority
              sizes="(max-width: 700px) 100vw, 50vw"
            />
            <Spotlight className="-left-20 -top-20" fill="#d9e3ff" />
            <span className="hero-media-tag">THE KORA EDIT / 01</span>
            {heroProduct && (
              <div className="hero-product-float">
                <Image
                  src={heroProduct.imageUrl}
                  alt=""
                  width={58}
                  height={58}
                />
                <div>
                  <small>Meet your next favourite</small>
                  <Link href={`/product/${heroProduct.slug}`}>
                    <h2>{heroProduct.title}</h2>
                  </Link>
                  <strong>{money(effectivePrice(heroProduct))}</strong>
                  {heroProduct.originalPriceNaira &&
                    heroProduct.originalPriceNaira >
                      effectivePrice(heroProduct) && (
                      <s>{money(heroProduct.originalPriceNaira)}</s>
                    )}
                </div>
                <button
                  onClick={() => addItem(heroProduct.id)}
                  disabled={heroProduct.stock <= heroProduct.reserved}
                  aria-label={`Add ${heroProduct.title} to bag`}
                >
                  <ShoppingBag size={19} />
                </button>
              </div>
            )}
          </motion.div>
        </div>
      </section>
      <div className="page-width assurance-strip">
        {[
          { icon: Truck, title: "Across Nigeria", text: "All 36 states + FCT" },
          {
            icon: ShieldCheck,
            title: "Considered essentials",
            text: "Selected with care",
          },
          {
            icon: CreditCard,
            title: "More ways to pay",
            text: "Card, transfer & USSD",
          },
          {
            icon: RotateCcw,
            title: "Shop with clarity",
            text: "Clear returns guidance",
          },
        ].map(({ icon: Icon, title, text }) => (
          <div className="assurance-item" key={title}>
            <Icon size={25} strokeWidth={1.6} />
            <div>
              <b>{title}</b>
              <p>{text}</p>
            </div>
          </div>
        ))}
      </div>
      <section className="page-width category-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">YOUR WORLD, UPGRADED</p>
            <h2>Find your kind of good.</h2>
          </div>
          <Link href="/shop" className="text-link">
            Explore all categories
          </Link>
        </div>
        <div className="category-grid">
          {categories.map((c, i) => (
            <motion.div
              key={c.title}
              initial={{ opacity: 1, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
            >
              <Link
                href={`/shop?category=${encodeURIComponent(c.title)}`}
                className="category-card"
              >
                <div className="category-photo">
                  <Image
                    src={`/images/${c.image}.webp`}
                    alt={c.title}
                    fill
                    sizes="(max-width: 700px) 45vw, 23vw"
                  />
                </div>
                <div className="category-copy">
                  <div>
                    <h3>{c.title}</h3>
                    <p>{c.subtitle}</p>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>
      <section className="deals-section">
        <div className="page-width">
          <div className="section-heading deals-heading">
            <div>
              <p className="eyebrow">
                <Zap size={14} /> LIMITED TIME. EVERYDAY VALUE.
              </p>
              <h2>
                Good finds. <em>Great prices.</em>
              </h2>
              <p className="section-description">
                A few favourites, a little less. Catch them while they're here.
              </p>
            </div>
            <div className="deals-right">
              {deals[0]?.dealEndsAt && (
                <div className="deals-timer">
                  <span>DEALS END IN</span>
                  <Countdown endsAt={deals[0].dealEndsAt} />
                </div>
              )}
              <Link href="/shop?collection=deals" className="text-link">
                Shop all deals
              </Link>
            </div>
          </div>
          {deals.length ? (
            <div className="product-grid">
              {deals.map((p, i) => (
                <ProductCard product={p} key={p.id} index={i} />
              ))}
            </div>
          ) : (
            <div className="deals-empty">
              <h3>Today's deals have wrapped up.</h3>
              <p>Explore the collection for your next good find.</p>
              <Link href="/shop" className="text-link">
                Explore the store
              </Link>
            </div>
          )}
          <div className="deals-bottom">
            <span>
              <PackageCheck size={15} />
              Same good quality. Even better value.
            </span>
            <span>Little wins feel good.</span>
          </div>
        </div>
      </section>
      <section className="page-width featured-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">YOUR NEXT FAVOURITES</p>
            <h2>Made for your everyday.</h2>
          </div>
          <Link href="/shop" className="text-link">
            Shop the collection
          </Link>
        </div>
        <div
          className="collection-tabs"
          role="group"
          aria-label="Featured collections"
        >
          {["For you", "New arrivals", "Best sellers"].map((tab) => (
            <button
              aria-pressed={collection === tab}
              key={tab}
              className={cn(collection === tab && "selected")}
              onClick={() => setCollection(tab)}
            >
              {tab}
              {collection === tab && (
                <motion.span
                  layoutId="collection-tab"
                  className="tab-underline"
                />
              )}
            </button>
          ))}
        </div>
        <div className="product-grid featured-grid">
          {featured.map((p, i) => (
            <ProductCard product={p} index={i} key={p.id} />
          ))}
        </div>
        <div className="featured-more">
          <Button asChild variant="outline">
            <Link href="/shop">There's more to love</Link>
          </Button>
        </div>
      </section>
      <section className="page-width editorial-grid">
        <Link
          className="editorial-card home-edit"
          href="/shop?category=Home%20%26%20Living"
        >
          <Image
            src="/images/home.webp"
            alt="A warm living room with considered natural materials"
            fill
            sizes="(max-width: 700px) 90vw, 45vw"
          />
          <div className="editorial-copy">
            <p className="eyebrow">THE HOME EDIT</p>
            <h2>
              Your space.
              <br />A little more you.
            </h2>
            <span>Find your comfort zone</span>
          </div>
        </Link>
        <Link
          className="editorial-card style-edit"
          href="/shop?category=Fashion"
        >
          <Image
            src="/images/fashion.webp"
            alt="Everyday clothing in soft natural textures"
            fill
            sizes="(max-width: 700px) 90vw, 45vw"
          />
          <div className="editorial-copy">
            <p className="eyebrow">THE EVERYDAY EDIT</p>
            <h2>
              Less effort.
              <br />
              More you.
            </h2>
            <span>Find your everyday style</span>
          </div>
        </Link>
      </section>
      <RecentlyViewed />
      <section className="page-width kora-promise">
        <div className="promise-mark">
          <Leaf size={27} />
        </div>
        <p className="eyebrow">THE KORA WAY</p>
        <h2>
          Good things shouldn't
          <br />
          be hard to find.
        </h2>
        <p>
          Things that work well, feel good, and fit into your life. From your
          first search to your next delivery, we're here for the everyday
          upgrades.
        </p>
        <div className="promise-values">
          <span>
            <ShieldCheck size={16} />
            Picked with care
          </span>
          <span>
            <Headphones size={16} />
            Made for real life
          </span>
          <span>
            <Truck size={16} />
            Across Nigeria
          </span>
        </div>
      </section>
    </>
  );
}
