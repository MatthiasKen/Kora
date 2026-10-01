import { config } from "dotenv";
config({ path: ".env.local" });
const { getDb } = await import("../src/db");
const { products } = await import("../src/db/schema");
const { demoProducts } = await import("../src/lib/catalog-data");
const db = getDb();
try {
  const seed = demoProducts().map((p) => ({
    ...p,
    dealEndsAt: p.dealEndsAt ? new Date(p.dealEndsAt) : null,
  }));
  // Do not reset stock or prices for products already in a live catalog.
  await db.insert(products).values(seed).onConflictDoNothing();
  console.log(
    `Seeded ${seed.length} sample products. Existing products were preserved.`,
  );
} finally {
  await db.$client.end();
}
