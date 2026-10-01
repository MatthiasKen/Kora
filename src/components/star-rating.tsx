import { Star } from "lucide-react";

export function ReviewStars({ rating, size = 16 }: { rating: number; size?: number }) {
  const value = Number.isFinite(rating) ? Math.min(5, Math.max(0, rating)) : 0;
  return (
    <span className="review-stars" role="img" aria-label={value ? value + " out of 5 stars" : "No ratings yet"}>
      {[1, 2, 3, 4, 5].map(star => (
        <Star key={star} size={size} aria-hidden="true" fill={star <= Math.round(value) ? "currentColor" : "none"} />
      ))}
    </span>
  );
}
