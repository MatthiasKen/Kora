import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { NextRequest } from "next/server";
import { GET, POST } from "../src/app/api/auth/[...nextauth]/route";
import { currentUser } from "../src/lib/auth";

const keys = ["APP_MODE", "DATABASE_URL", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "NEXTAUTH_SECRET"] as const;
const original = Object.fromEntries(keys.map(key => [key, process.env[key]]));
const context = (action: string[]) => ({ params: Promise.resolve({ nextauth: action }) });

describe("guest access before Google authentication is configured", () => {
  beforeEach(() => {
    for (const key of keys) delete process.env[key];
    process.env.APP_MODE = "live";
    process.env.DATABASE_URL = "postgresql://localhost/auth-configuration-test";
  });
  afterEach(() => {
    for (const key of keys) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  });
  it("reports an anonymous, uncached session without a production secret", async () => {
    const response = await GET(new NextRequest("https://store.example.com/api/auth/session", {
      headers: { cookie: "__Secure-next-auth.session-token=untrusted-token" },
    }), context(["session"]));
    assert.equal(response.status, 200);
    assert.equal(await response.json(), null);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.equal(response.headers.get("Set-Cookie"), null);
    assert.equal(await currentUser(), null);
  });
  it("advertises no sign-in providers until setup is complete", async () => {
    const response = await GET(new NextRequest("https://store.example.com/api/auth/providers"), context(["providers"]));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {});
  });
  it("refuses login and callback actions without creating a session", async () => {
    for (const [method, action] of [["POST", "signin"], ["GET", "callback"], ["POST", "session"]] as const) {
      const handle = method === "POST" ? POST : GET;
      const response = await handle(new NextRequest(`https://store.example.com/api/auth/${action}/google`, { method }), context([action, "google"]));
      assert.equal(response.status, 503);
      assert.match((await response.json()).error, /not configured/);
      assert.equal(response.headers.get("Set-Cookie"), null);
    }
  });
  it("keeps partially configured Google authentication anonymous", async () => {
    process.env.GOOGLE_CLIENT_ID = "configuration-test-client";
    process.env.GOOGLE_CLIENT_SECRET = "configuration-test-secret";
    assert.equal(await currentUser(), null);
    const response = await GET(new NextRequest("https://store.example.com/api/auth/session"), context(["session"]));
    assert.equal(await response.json(), null);
  });
  it("never enables real authentication in demo mode", async () => {
    process.env.APP_MODE = "demo";
    process.env.GOOGLE_CLIENT_ID = "configuration-test-client";
    process.env.GOOGLE_CLIENT_SECRET = "configuration-test-secret";
    process.env.NEXTAUTH_SECRET = "configuration-test-session-secret-32-characters";
    assert.equal(await currentUser(), null);
    const response = await GET(new NextRequest("https://store.example.com/api/auth/providers"), context(["providers"]));
    assert.deepEqual(await response.json(), {});
  });
});
