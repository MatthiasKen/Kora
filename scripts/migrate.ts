import { config } from "dotenv";
config({ path: ".env.local" });
const { getDb } = await import("../src/db");
const { migrate } = await import("drizzle-orm/neon-serverless/migrator");
const db = getDb();
try {
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Database migrations applied.");
} finally {
  await db.$client.end();
}
