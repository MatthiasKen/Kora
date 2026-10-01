"use client";
import Link from "next/link";
import { ArrowUpRight, Leaf, ShieldCheck, Heart } from "lucide-react";
import { Logo } from "./site-header";
import { useStore } from "./store-provider";
export function SiteFooter() {
  const { config } = useStore();
  return (
    <footer className="site-footer">
      <div className="page-width footer-grid">
        <div className="footer-about">
          <Logo />
          <p>
            Thoughtfully picked essentials.
            <br />
            For a life a little more elevated.
          </p>
          <span className="footer-nigeria">
            <span className="nigeria-flag" />
            Made for everyday life in Nigeria.
          </span>
        </div>
        <div>
          <h3>Find your favourites</h3>
          <Link href="/shop">Shop all</Link>
          <Link href="/shop?collection=new">New arrivals</Link>
          <Link href="/shop?collection=bestsellers">Best sellers</Link>
          <Link href="/shop?collection=deals">Daily deals</Link>
        </div>
        <div>
          <h3>Here to help</h3>
          <Link href="/help">Help & FAQs</Link>
          <Link href="/help#delivery">Delivery information</Link>
          <Link href="/help#returns">Returns & exchanges</Link>
          <Link href="/account">Your account & orders</Link>
          <Link href="/track-order">Track your delivery</Link>
          {config.ownerToolsAvailable && <Link href="/admin/orders">Manage orders & delivery</Link>}
        </div>
        <div className="footer-note">
          <Leaf size={26} strokeWidth={1.2} />
          <h3>
            Less scrolling.
            <br />
            More good finds.
          </h3>
          <p>Discover the everyday things that make a difference.</p>
          <Link href="/shop" className="footer-shop-link">
            Meet your new favourites <ArrowUpRight size={16} />
          </Link>
        </div>
      </div>
      <div className="page-width footer-bottom">
        <span>
          © {new Date().getFullYear()} Kora. Made with care <Heart size={11} />
        </span>
        <div>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </div>
        <span className="footer-payment">
          <ShieldCheck size={14} />
          {config.demo ? "Demo store · sample checkout" : "Secured by Paystack"}
          <b>VISA</b>
          <b className="mastercard">
            <i />
            <i />
          </b>
          <small>Transfer / USSD</small>
        </span>
      </div>
    </footer>
  );
}
