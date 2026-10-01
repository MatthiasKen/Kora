import { Suspense } from "react";
import { ProductCatalog } from "@/components/product-catalog";
export const metadata = { title: "Shop the collection" };
export default function Shop() {
  return (
    <Suspense
      fallback={
        <div className="page-width py-20 text-subtle">
          Finding your favourites...
        </div>
      }
    >
      <ProductCatalog />
    </Suspense>
  );
}
