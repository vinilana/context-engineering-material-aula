import { test, afterAll } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { createSqliteContextRepository } from "../src/infrastructure/sqlite-context-repository.js";
import { seedContextDatabase } from "../src/infrastructure/seed-sqlite-context.js";
import { createContextEngine } from "../src/engine.js";

const corpus = fileURLToPath(new URL("../data/seed/", import.meta.url));
const directory = await mkdtemp(join(tmpdir(), "pronto-engine-test-"));
afterAll(() => rm(directory, { recursive: true, force: true }));
const databasePath = join(directory, "context.sqlite");
await seedContextDatabase({ databasePath, corpusRoot: corpus, schemaPath: fileURLToPath(new URL("../data/schema.sql", import.meta.url)) });
const repository = createSqliteContextRepository({ databasePath }).ports.contextRepository;
const engine = createContextEngine({ contextRepository: repository });

test("capabilities use an injected repository and forward invocation cancellation", async () => {
  const observed: AbortSignal[] = [];
  const isolated = createContextEngine({
    contextRepository: {
      async get(_id, signal) {
        observed.push(signal);
        return null;
      },
      async search(_input, signal) {
        observed.push(signal);
        return [];
      },
    },
  });
  assert.deepEqual(await isolated.invoke("context.get_document", { id: "unknown" }), { found: false, document: null });
  assert.deepEqual((await isolated.invoke("context.search", { query: "refund" })).hits, []);
  assert.equal(observed.length, 2);
  assert.ok(observed.every((signal) => signal instanceof AbortSignal));
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(isolated.invoke("context.search", { query: "refund" }, { signal: controller.signal }), { code: "CANCELLED" });
  assert.equal(observed.length, 2);
});

test("retrieves active context across service repositories and corporate policies", async () => {
  const { hits } = await engine.invoke("context.search", { query: "cancelar estorno" });
  assert.equal(hits.length, 3);
  assert.deepEqual(new Set(hits.map((hit) => hit.repository)), new Set(["billing-service", "logistics-service", "company-handbook"]));
  assert.ok(hits.every((hit) => hit.status === "active" && hit.uri.startsWith("repo://") && hit.owner && hit.version));
  const filtered = await engine.invoke("context.search", { query: "refund", repository: "billing-service", limit: 1 });
  assert.equal(filtered.hits[0]?.id, "billing-refund-v2");
});

test("deprecated policies require opt-in and identify the replacement", async () => {
  const { hits } = await engine.invoke("context.search", { query: "cancelamento", includeDeprecated: true });
  assert.ok(hits.some((hit) => hit.id === "cancellation-policy-v1"));
  const { document } = await engine.invoke("context.get_document", { id: "cancellation-policy-v1" });
  assert.equal(document?.status, "deprecated");
  assert.equal(document?.supersededBy, "cancellation-policy-v2");
  assert.match(document?.warning ?? "", /cancellation-policy-v2/);
});

test("document reads preserve provenance and hash the actual source", async () => {
  const { found, document } = await engine.invoke("context.get_document", { id: "billing-refund-v2" });
  assert.equal(found, true);
  assert.ok(document);
  assert.match(document.content, /amountInCents/);
  assert.equal(document.sha256, createHash("sha256").update(document.content).digest("hex"));
  assert.deepEqual(await engine.invoke("context.get_document", { id: "../../etc/passwd" }), { found: false, document: null });
});

test("task bundles contain the three current sources and do not claim completeness", async () => {
  const result = await engine.invoke("context.prepare_task", { task: "Implementar cancelamento de pedido com estorno e evento de logística" });
  assert.equal(result.documents.length, 3);
  assert.ok(result.documents.every((doc) => doc.status === "active"));
  assert.match(result.notice, /sem garantia de completude/);
  const empty = await engine.invoke("context.search", { query: "astronomia zzzzz" });
  assert.deepEqual(empty.hits, []);
});

test("input schemas reject invalid limits and unknown arguments", async () => {
  await assert.rejects(engine.invoke("context.search", { query: "refund", limit: 100 }), { code: "INPUT_INVALID" });
  await assert.rejects(engine.invoke("context.search", { query: "   " }), { code: "INPUT_INVALID" });
  await assert.rejects(engine.invoke("context.get_document", { id: "billing-refund-v2", path: "/etc/passwd" } as never), { code: "INPUT_INVALID" });
});


test("retrieves repository architecture and implementation patterns from SQLite", async () => {
  const result = await engine.invoke("context.search", { query: "arquitetura padrões", repository: "pronto-delivery" });
  assert.deepEqual(new Set(result.hits.map((hit) => hit.id)), new Set(["pronto-repository-overview", "pronto-implementation-patterns"]));
  assert.ok(result.hits.every((hit) => ["repository", "standard"].includes(hit.kind)));
});
