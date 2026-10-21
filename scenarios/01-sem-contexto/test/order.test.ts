import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createApplication } from "../src/app.js";
import { createDependencies, MemoryCatalog } from "../src/infrastructure/memory.js";

const input = {
  customerId: "customer-1",
  restaurantId: "rest-1",
  paymentId: "pay-1",
  deliveryAddress: "Rua das Flores, 123",
  items: [{ productId: "prod-1", quantity: 2 }, { productId: "prod-2", quantity: 1 }],
};

test("calculates totals from catalog prices and preserves the item snapshot", () => {
  const dependencies = createDependencies();
  const { service } = createApplication(dependencies);
  const order = service.place(input);
  assert.equal(order.subtotalCents, 7200);
  assert.equal(order.deliveryFeeCents, 700);
  assert.equal(order.totalCents, 7900);
  assert.equal(order.status, "placed");
  order.items[0]!.unitPriceCents = 1;
  assert.equal(service.get(order.id).items[0]!.unitPriceCents, 3200);
  dependencies.catalog = new MemoryCatalog([], []);
  assert.equal(service.get(order.id).totalCents, 7900);
});

test("rejects closed restaurants, unavailable products and cross-restaurant items", () => {
  const { service } = createApplication();
  assert.throws(() => service.place({ ...input, restaurantId: "rest-2" }), { code: "RESTAURANT_CLOSED" });
  for (const productId of ["prod-3", "prod-4", "missing"]) {
    assert.throws(() => service.place({ ...input, items: [{ productId, quantity: 1 }] }), { code: "PRODUCT_UNAVAILABLE" });
  }
  assert.throws(() => service.place({ ...input, items: [] }), { code: "EMPTY_ORDER" });
  assert.throws(() => service.place({ ...input, items: [{ productId: "prod-1", quantity: 0 }] }), { code: "INVALID_QUANTITY" });
});

test("enforces the lifecycle and returns a domain error for missing orders", () => {
  const { service } = createApplication();
  const order = service.place(input);
  assert.throws(() => service.changeStatus(order.id, "delivered"), { code: "INVALID_STATUS_TRANSITION" });
  for (const status of ["confirmed", "preparing", "dispatched", "delivered"] as const) {
    assert.equal(service.changeStatus(order.id, status).status, status);
  }
  assert.throws(() => service.changeStatus(order.id, "confirmed"), { code: "INVALID_STATUS_TRANSITION" });
  assert.throws(() => service.get("missing"), { code: "ORDER_NOT_FOUND" });
});

test("HTTP validates input, maps domain errors and supports the order lifecycle", async (t) => {
  const { server } = createApplication();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  const post = (path: string, body: unknown) => fetch(`${base}${path}`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
  const response = await post("/orders", input);
  assert.equal(response.status, 201);
  const order = await response.json() as { id: string; totalCents: number };
  assert.equal(order.totalCents, 7900);
  assert.equal((await fetch(`${base}/orders/${order.id}`)).status, 200);
  assert.equal((await post(`/orders/${order.id}/status`, { status: "confirmed" })).status, 200);
  assert.equal((await post(`/orders/${order.id}/status`, { status: "delivered" })).status, 409);
  assert.equal((await post("/orders", { ...input, totalCents: 1 })).status, 422);
  assert.equal((await post("/orders", { ...input, items: [{ productId: "prod-1", quantity: -1 }] })).status, 422);
  const invalid = await fetch(`${base}/orders`, { method: "POST", body: "{" });
  assert.equal(invalid.status, 400);
  assert.equal((await fetch(`${base}/orders/missing`)).status, 404);
  assert.equal((await fetch(`${base}/unknown`)).status, 404);
  const large = await fetch(`${base}/orders`, { method: "POST", body: "x".repeat(65537) });
  assert.equal(large.status, 413);
});
