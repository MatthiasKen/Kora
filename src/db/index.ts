import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import WebSocket from "ws";
import * as schema from "./schema";
// Native WebSocket in Workers and modern Node; ws is the fallback for older runtimes.
neonConfig.webSocketConstructor =
  typeof globalThis.WebSocket !== "undefined"
    ? globalThis.WebSocket
    : WebSocket;
neonConfig.poolQueryViaFetch = true;
export function getDb() {
  if (!process.env.DATABASE_URL)
    throw new Error("DATABASE_URL is not configured.");
  // Each request owns its pool. maxUses: 1 closes the transaction socket when released.
  // Single queries use HTTPS; interactive transactions use the Neon WebSocket driver.
  return drizzle(
    new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 1,
      maxUses: 1,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 1000,
      allowExitOnIdle: true,
    }),
    { schema },
  );
}
export type Database = ReturnType<typeof getDb>;
