import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  filterCatalog,
  knownProductIds,
  productMatches,
  type CatalogFilters,
} from "../src/lib/catalog-tools";
import { emailRecipientSchema, shippingSchema } from "../src/lib/validation";
import { readBody, readJson } from "../src/lib/request-body";
import { AppError, errorResponse, fieldError } from "../src/lib/errors";
import type { Product } from "../src/lib/types";

function product(id: string, extra: Partial<Product> = {}): Product {
  return {
    id,
    slug: id,
    title: "Wireless Studio Headphones",
    description: "Everyday sound and USB-C charging",
    category: "Electronics",
    priceNaira: 43500,
    originalPriceNaira: 58000,
    stock: 3,
    reserved: 0,
    imageUrl: "/sample.webp",
    isDailyDeal: false,
    isNewArrival: false,
    isBestSeller: false,
    dealEndsAt: null,
    rating: "4.5",
    reviewCount: 12,
    features: [],
    color: "#fff",
    ...extra,
  };
}
const filters: CatalogFilters = {
  category: "All products",
  collection: "all",
  query: "",
  priceMax: Infinity,
  onSale: false,
  inStock: false,
  ratingMin: 0,
  sort: "featured",
};
describe("Shopping filters and persisted product selections", () => {
  it("matches all search words irrespective of order and whitespace", () => {
    assert.equal(productMatches(product("a"), "  headphones WIRELESS  "), true);
    assert.equal(productMatches(product("a"), "wireless camera"), false);
  });
  it("combines category, stock, rating, discount and price before sorting", () => {
    const rows = [
      product("a"),
      product("b", { priceNaira: 30000, rating: "4.9" }),
      product("c", { stock: 2, reserved: 2 }),
      product("d", { category: "Fashion" }),
      product("e", { rating: "3.9" }),
    ];
    const result = filterCatalog(rows, {
      ...filters,
      category: "Electronics",
      inStock: true,
      ratingMin: 4,
      onSale: true,
      priceMax: 50000,
      sort: "price-low",
    });
    assert.deepEqual(
      result.map((p) => p.id),
      ["b", "a"],
    );
    assert.deepEqual(
      rows.map((p) => p.id),
      ["a", "b", "c", "d", "e"],
    );
  });
  it("removes expired deals and uses the restored price in range and sale filters", () => {
    const row = product("a", {
      isDailyDeal: true,
      dealEndsAt: "2026-10-01T10:00:00Z",
    });
    const before = Date.parse("2026-10-01T09:00:00Z"),
      after = Date.parse("2026-10-01T10:00:00Z");
    assert.equal(
      filterCatalog([row], { ...filters, collection: "deals" }, before).length,
      1,
    );
    assert.equal(
      filterCatalog([row], { ...filters, collection: "deals" }, after).length,
      0,
    );
    assert.equal(
      filterCatalog([row], { ...filters, onSale: true }, after).length,
      0,
    );
    assert.equal(
      filterCatalog([row], { ...filters, priceMax: 50000 }, after).length,
      0,
    );
  });
  it("does not hide high-priced inventory by default and validates saved comparison IDs", () => {
    const rows = [
      product("a"),
      product("b", { priceNaira: 150000 }),
      product("c"),
      product("d"),
    ];
    assert.equal(filterCatalog(rows, filters).length, 4);
    assert.deepEqual(
      knownProductIds(["a", "unknown", "a", 2, "b", "c", "d"], rows, 3),
      ["a", "b", "c"],
    );
    assert.deepEqual(knownProductIds({ a: true }, rows, 3), []);
  });
});
describe("Shared field validation and bounded requests", () => {
  it("trims recipients, normalizes email and identifies invalid fields", () => {
    assert.deepEqual(
      emailRecipientSchema.parse({
        name: "  Amaka  ",
        email: "  AMAKA@example.com  ",
      }),
      { name: "Amaka", email: "amaka@example.com" },
    );
    const result = emailRecipientSchema.safeParse({
      name: " ",
      email: "bad-address",
    });
    assert.equal(result.success, false);
    if (!result.success)
      assert.deepEqual(
        result.error.issues.map((issue) => issue.path[0]),
        ["name", "email"],
      );
  });
  it("rejects unsupported states and invalid Nigerian phone numbers", () => {
    const address = {
      fullName: "Amaka Okafor",
      email: "amaka@example.com",
      phone: "08012345678",
      address: "12 Sample Street",
      city: "Ikeja",
      state: "Lagos",
    };
    assert.equal(shippingSchema.safeParse(address).success, true);
    assert.equal(
      shippingSchema.safeParse({ ...address, state: "London" }).success,
      false,
    );
    assert.equal(
      shippingSchema.safeParse({ ...address, phone: "1234" }).success,
      false,
    );
  });
  it("returns structured field errors without exposing internals", async () => {
    const response = errorResponse(
      fieldError([
        {
          path: ["shipping", "phone"],
          message: "Enter a Nigerian phone number.",
        },
      ]),
    );
    assert.equal(response.status, 422);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(await response.json(), {
      error: "Please correct the highlighted details.",
      fields: { "shipping.phone": "Enter a Nigerian phone number." },
    });
  });
  it("rejects malformed JSON and incorrect content types with client errors", async () => {
    const make = (body: string, type = "application/json") =>
      new Request("https://example.test", {
        method: "POST",
        body,
        headers: { "Content-Type": type },
      });
    assert.deepEqual(await readJson(make('{"name":"Amaka"}')), {
      name: "Amaka",
    });
    await assert.rejects(
      readJson(make("{")),
      (e: unknown) => e instanceof AppError && e.status === 400,
    );
    await assert.rejects(
      readJson(make("{}", "text/plain")),
      (e: unknown) => e instanceof AppError && e.status === 415,
    );
  });
  it("enforces actual byte limits when no Content-Length is supplied", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("₦₦"));
        controller.enqueue(new TextEncoder().encode("₦₦"));
        controller.close();
      },
    });
    const request = new Request("https://example.test", {
      method: "POST",
      body: stream,
      duplex: "half",
    } as RequestInit);
    await assert.rejects(
      readBody(request, 8),
      (e: unknown) => e instanceof AppError && e.status === 413,
    );
  });
});
