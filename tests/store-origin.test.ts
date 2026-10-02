import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { appOrigin } from "../src/lib/config";
import { assertSameOrigin, cookieOptions } from "../src/lib/security";

const keys = ["APP_URL", "NEXTAUTH_URL", "VERCEL", "VERCEL_ENV", "VERCEL_PROJECT_PRODUCTION_URL", "VERCEL_URL"] as const;
const original = Object.fromEntries(keys.map(key => [key, process.env[key]]));
const request = (origin: string) => new Request("https://store.example/api/cart", { headers: { origin } });

describe("store origin configuration and guest cookie security", () => {
  beforeEach(() => { for (const key of keys) delete process.env[key]; });
  afterEach(() => {
    for (const key of keys) {
      if (original[key] === undefined) delete process.env[key];
      else Object.assign(process.env, { [key]: original[key] });
    }
  });
  it("keeps an explicitly configured storefront ahead of platform defaults", () => {
    process.env.APP_URL = "https://shop.example/";
    process.env.NEXTAUTH_URL = "https://auth.example";
    process.env.VERCEL = "1";
    process.env.VERCEL_ENV = "production";
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "project.vercel.app";
    assert.equal(appOrigin(), "https://shop.example");
    assert.doesNotThrow(() => assertSameOrigin(request("https://shop.example")));
    assert.throws(() => assertSameOrigin(request("https://project.vercel.app")));
    assert.equal(cookieOptions().secure, true);
  });
  it("supports NEXTAUTH_URL when APP_URL has not been set", () => {
    process.env.NEXTAUTH_URL = "https://shop.example";
    assert.equal(appOrigin(), "https://shop.example");
    assert.equal(cookieOptions().secure, true);
  });
  it("uses Vercel's production domain for writes and secure guest cookies", () => {
    process.env.VERCEL = "1";
    process.env.VERCEL_ENV = "production";
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "store.vercel.app";
    process.env.VERCEL_URL = "store-deployment.vercel.app";
    assert.equal(appOrigin(), "https://store.vercel.app");
    assert.doesNotThrow(() => assertSameOrigin(request("https://store.vercel.app")));
    assert.throws(() => assertSameOrigin(request("https://store-deployment.vercel.app")));
    assert.equal(cookieOptions().secure, true);
    assert.equal(cookieOptions().httpOnly, true);
    assert.equal(cookieOptions().sameSite, "lax");
  });
  it("keeps preview writes on their deployment instead of production", () => {
    process.env.VERCEL = "1";
    process.env.VERCEL_ENV = "preview";
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "store.vercel.app";
    process.env.VERCEL_URL = "store-preview.vercel.app";
    assert.equal(appOrigin(), "https://store-preview.vercel.app");
    assert.doesNotThrow(() => assertSameOrigin(request("https://store-preview.vercel.app")));
    assert.throws(() => assertSameOrigin(request("https://store.vercel.app")));
  });
  it("refuses missing configuration and does not infer an origin from request headers", () => {
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "store.vercel.app";
    assert.throws(() => appOrigin(), /APP_URL/);
    assert.throws(() => assertSameOrigin(new Request("https://store.vercel.app/api/cart", {
      headers: { origin: "https://store.vercel.app", host: "store.vercel.app", "x-forwarded-host": "store.vercel.app" },
    })), /APP_URL/);
  });
  it("rejects foreign and missing origins even with the Vercel fallback", () => {
    process.env.VERCEL = "1";
    process.env.VERCEL_ENV = "production";
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "store.vercel.app";
    assert.throws(() => assertSameOrigin(request("https://attacker.example")), /did not originate/);
    assert.throws(() => assertSameOrigin(new Request("https://store.vercel.app/api/cart")), /did not originate/);
  });
  it("preserves local HTTP development without secure-only cookies", () => {
    process.env.APP_URL = "http://localhost:3000";
    assert.equal(appOrigin(), "http://localhost:3000");
    assert.doesNotThrow(() => assertSameOrigin(request("http://localhost:3000")));
    assert.equal(cookieOptions().secure, false);
  });
});
