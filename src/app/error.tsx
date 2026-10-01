"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ retry }: { retry: () => void }) {
  return (
    <div className="page-width status-page">
      <span className="eyebrow">A LITTLE PAUSE</span>
      <h1>Something didn't load.</h1>
      <p>
        We couldn't load this page. Check your connection and try again.
      </p>
      <Button onClick={retry}>Try again</Button>
    </div>
  );
}
