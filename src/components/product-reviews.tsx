"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, ShieldCheck, Star } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "./store-provider";
import { ReviewStars } from "./star-rating";
import { Button } from "./ui/button";
import { useFieldValidation } from "./use-field-validation";
import { reviewSchema } from "@/lib/validation";
import { DEMO_REVIEW_KEY, readDemoReviews, reviewAuthor, summarizeReviews } from "@/lib/reviews";
import type { Review, ReviewPage } from "@/lib/types";

function ReviewForm({ productId, ownReview, onSaved }: { productId: string; ownReview: Review | null; onSaved: (page?: ReviewPage) => void }) {
  const { user, config } = useStore();
  const [value, setValue] = useState({ rating: ownReview?.rating || 0, title: ownReview?.title || "", body: ownReview?.body || "" });
  const fields = useFieldValidation(reviewSchema, value);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !user) return;
    const parsed = fields.validate();
    if (!parsed.success) { document.getElementById("review-" + String(parsed.error.issues[0].path[0]))?.focus(); return; }
    setBusy(true); setError("");
    try {
      if (config.demo) {
        const rows = readDemoReviews();
        const now = new Date().toISOString();
        const row: Review = { ...parsed.data, id: ownReview?.id || crypto.randomUUID(), productId, authorId: user.id,
          author: reviewAuthor(user.name), verifiedPurchase: false, demo: true, createdAt: ownReview?.createdAt || now, updatedAt: now };
        localStorage.setItem(DEMO_REVIEW_KEY, JSON.stringify([row, ...rows.filter(review => !(review.authorId === user.id && review.productId === productId))]));
        window.dispatchEvent(new Event("kora-reviews-updated"));
        onSaved();
      } else {
        const response = await fetch("/api/products/" + encodeURIComponent(productId) + "/reviews", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data), signal: AbortSignal.timeout(15000),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Your review could not be saved. Please try again.");
        onSaved(data);
      }
      toast.success(ownReview ? "Your review has been updated." : "Thank you. Your review is published.");
    } catch (e) { setError(e instanceof Error ? e.message : "Your review could not be saved. Please try again."); }
    finally { setBusy(false); }
  }
  return <form className="review-form" noValidate onSubmit={submit} aria-busy={busy}>
    <h3>{ownReview ? "Update your review" : "Share your experience"}</h3>
    <fieldset id="review-rating" tabIndex={-1} aria-describedby={fields.errors.rating ? "review-rating-error" : undefined}>
      <legend>Your rating</legend>
      <div className="rating-picker">{[1,2,3,4,5].map(rating => <label key={rating} className={value.rating >= rating ? "chosen" : ""}>
        <input type="radio" name="rating" value={rating} checked={value.rating === rating} onChange={() => setValue(current => ({ ...current, rating }))} onBlur={() => fields.touch("rating")} aria-label={rating + (rating === 1 ? " star" : " stars")} />
        <Star size={25} fill={value.rating >= rating ? "currentColor" : "none"} aria-hidden="true" />
      </label>)}</div>
      <p className="rating-selection" aria-live="polite">{value.rating ? value.rating + (value.rating === 1 ? " star selected" : " stars selected") : "Choose 1–5 stars"}</p>
      {fields.errors.rating && <p className="field-error" id="review-rating-error">{fields.errors.rating}</p>}
    </fieldset>
    <label htmlFor="review-title">Review title</label>
    <input id="review-title" value={value.title} maxLength={120} onChange={e => setValue(current => ({ ...current, title: e.target.value }))} onBlur={() => fields.touch("title")} aria-invalid={!!fields.errors.title} aria-describedby={fields.errors.title ? "review-title-error" : undefined} placeholder="What stood out to you?" />
    {fields.errors.title && <p className="field-error" id="review-title-error">{fields.errors.title}</p>}
    <label htmlFor="review-body">Your review</label>
    <textarea id="review-body" rows={4} value={value.body} maxLength={1500} onChange={e => setValue(current => ({ ...current, body: e.target.value }))} onBlur={() => fields.touch("body")} aria-invalid={!!fields.errors.body} aria-describedby={fields.errors.body ? "review-body-error" : undefined} placeholder="Tell other shoppers about using this item." />
    {fields.errors.body && <p className="field-error" id="review-body-error">{fields.errors.body}</p>}
    <small>Reviews are public. Please leave out your phone number, email, and address.</small>
    {error && <p className="field-error" role="alert">{error}</p>}
    <Button disabled={busy} type="submit">{busy && <Loader2 size={17} className="animate-spin" />}{busy ? "Publishing…" : ownReview ? "Update review" : "Publish review"}</Button>
  </form>;
}
export function ProductReviews({ productId, initial }: { productId: string; initial: ReviewPage }) {
  const { user, config, hydrated, orders } = useStore();
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [sort, setSort] = useState("recent");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [owner, setOwner] = useState<string | null>(null);
  const identity = user?.id || null;
  const scope = productId + ":" + identity + ":" + sort;
  const activeScope = useRef(scope);
  activeScope.current = scope;
  function demoPage(page = 1): ReviewPage {
    const all = readDemoReviews().filter(row => row.productId === productId);
    const rows = [...all].sort((a,b) => (sort === "highest" ? b.rating - a.rating : sort === "lowest" ? a.rating - b.rating : 0) || Date.parse(b.createdAt) - Date.parse(a.createdAt));
    return { summary: summarizeReviews(all), reviews: rows.slice(0, page * 10), page, hasMore: rows.length > page * 10,
      eligible: !!user && orders.some(order => order.customerId === user.id && order.demo && order.items.some(item => item.productId === productId)),
      ownReview: all.find(row => row.authorId === identity) || null };
  }
  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    if (config.demo) { setData(demoPage()); setOwner(identity); setError(""); return; }
    const controller = new AbortController();
    setBusy(true); setError(""); setOwner(null);
    void fetch("/api/products/" + encodeURIComponent(productId) + "/reviews?sort=" + sort, { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) })
      .then(async response => { const page = await response.json(); if (!response.ok) throw new Error(page.error || "Reviews could not load."); if (!cancelled) { setData(page); setOwner(identity); } })
      .catch(e => { if (!cancelled) setError(e.message || "Reviews could not load. Please try again."); })
      .finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; controller.abort(); };
  }, [productId, identity, config.demo, hydrated, sort, revision, orders]);
  async function more() {
    if (busy) return;
    const requestScope = activeScope.current;
    if (config.demo) { setData(demoPage(data.page + 1)); return; }
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/products/" + encodeURIComponent(productId) + "/reviews?page=" + (data.page + 1) + "&sort=" + sort, { cache: "no-store", signal: AbortSignal.timeout(15000) });
      const page: ReviewPage & { error?: string } = await response.json();
      if (!response.ok) throw new Error(page.error || "Reviews could not load.");
      if (activeScope.current !== requestScope) return;
      setData(current => ({ ...page, reviews: [...current.reviews, ...page.reviews.filter(row => !current.reviews.some(old => old.id === row.id))] }));
    } catch (e) { if (activeScope.current === requestScope) setError((e as Error).message); }
    finally { if (activeScope.current === requestScope) setBusy(false); }
  }
  return <section className="page-width reviews-section" id="reviews">
    <div className="section-heading"><div><p className="eyebrow">FROM THE PEOPLE WHO USE IT</p><h2>Customer reviews</h2></div><span>{data.summary.count} {data.summary.count === 1 ? "review" : "reviews"}</span></div>
    {config.demo && <p className="preview-note">Demo reviews stay in this browser. Reviews from real purchases will appear after the store launches.</p>}
    <div className="reviews-grid">
      <aside className="review-overview">
        <div className="review-score"><strong>{data.summary.count ? data.summary.average.toFixed(1) : "—"}</strong><div><ReviewStars rating={data.summary.average} /><span>{data.summary.count ? "Based on customer reviews" : "No ratings yet"}</span></div></div>
        <div className="rating-distribution">{[5,4,3,2,1].map(rating => <div key={rating}><span>{rating} <Star size={12} fill="currentColor" /></span><div><i style={{ width: (data.summary.count ? data.summary.distribution[rating] / data.summary.count * 100 : 0) + "%" }} /></div><span>{data.summary.distribution[rating]}</span></div>)}</div>
        {user && owner === identity && data.eligible
          ? <ReviewForm key={identity + (data.ownReview?.updatedAt || "")} productId={productId} ownReview={data.ownReview} onSaved={page => { if (activeScope.current !== scope) return; if (page) { setData(page); setOwner(identity); setSort("recent"); router.refresh(); } else setRevision(value => value + 1); }} />
          : <div className="review-eligibility"><ShieldCheck size={22} /><h3>Made for honest feedback.</h3><p>{user ? "You can review this item after a confirmed purchase." : "Sign in to review an item you have purchased."}</p>{!user && <Button asChild variant="outline"><Link href="/account">Sign in to review</Link></Button>}</div>}
      </aside>
      <div className="review-list">
        <label className="review-sort">Sort reviews<select value={sort} onChange={e => setSort(e.target.value)}><option value="recent">Most recent</option><option value="highest">Highest rated</option><option value="lowest">Lowest rated</option></select></label>
        {error && <div className="checkout-error" role="alert">{error}<Button variant="outline" size="sm" onClick={() => setRevision(value => value + 1)}>Try again</Button></div>}
        {!data.reviews.length && <div className="reviews-empty"><Star size={28} /><h3>{busy ? "Loading reviews…" : "Be the first to share your experience."}</h3><p>Helpful details make choosing a little easier.</p></div>}
        {data.reviews.map(review => <article className="customer-review" key={review.id}>
          <div className="review-author"><span className="review-avatar">{review.author[0]}</span><div><b>{review.author}</b><small>{new Date(review.createdAt).toLocaleDateString("en-NG", { dateStyle: "medium" })}</small></div><span className="review-verified"><ShieldCheck size={14} />{review.demo ? "Demo review" : "Verified purchase"}</span></div>
          <ReviewStars rating={review.rating} size={14} /><h3>{review.title}</h3><p>{review.body}</p>{review.updatedAt !== review.createdAt && <small className="text-subtle">Edited</small>}
        </article>)}
        {data.hasMore && <Button variant="outline" disabled={busy} onClick={more}>{busy && <Loader2 size={16} className="animate-spin" />}Load more reviews</Button>}
      </div>
    </div>
  </section>;
}
