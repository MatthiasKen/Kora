import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function NotFound() {
  return (
    <div className="page-width status-page">
      <span className="eyebrow">404 · NOT FOUND</span>
      <h1>This find has wandered off.</h1>
      <p>There's still plenty to discover in the store.</p>
      <Button asChild>
        <Link href="/shop">Back to shopping</Link>
      </Button>
    </div>
  );
}
