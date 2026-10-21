import { test } from "vitest";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtemp, rm, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createSqliteContextRepository, sqliteContextRepository } from "../src/infrastructure/sqlite-context-repository.js";
import { seedContextDatabase } from "../src/infrastructure/seed-sqlite-context.js";
import { createContextEngine } from "../src/engine.js";

const corpusRoot = fileURLToPath(new URL("../data/seed/", import.meta.url));
const schemaPath = fileURLToPath(new URL("../data/schema.sql", import.meta.url));
const signal = () => new AbortController().signal;

async function fixture(t: { onTestFinished: (cleanup: () => Promise<void>) => void }) {
  const directory = await mkdtemp(join(tmpdir(), "pronto-sqlite-test-"));
  t.onTestFinished(() => rm(directory, { recursive: true, force: true }));
  const databasePath = join(directory, "context.sqlite");
  await seedContextDatabase({ databasePath, corpusRoot, schemaPath });
  const repository = createSqliteContextRepository({ databasePath }).ports.contextRepository;
  return { databasePath, repository, engine: createContextEngine({ contextRepository: repository }) };
}

test("connector construction is lazy and missing databases are not created", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "pronto-missing-db-"));
  t.onTestFinished(() => rm(directory, { recursive: true, force: true }));
  const databasePath = join(directory, "missing.sqlite");
  const repository = createSqliteContextRepository({ databasePath }).ports.contextRepository;
  await assert.rejects(access(databasePath));
  await assert.rejects(repository.get("anything", signal()), /Context database is unavailable/);
  await assert.rejects(access(databasePath));
});

test("live updates and FTS index changes are visible without rebuilding the engine", async (t) => {
  const { databasePath, engine } = await fixture(t);
  const before = await engine.invoke("context.get_document", { id: "cancellation-policy-v2" });
  const db = new DatabaseSync(databasePath);
  try {
    db.prepare("UPDATE context_documents SET content = content || ?, version = ?, updated_at = ? WHERE id = ?")
      .run("\nPolicy update: freshcontextmarker.\n", "2.0.1", "2026-10-21", "cancellation-policy-v2");
  } finally { db.close(); }
  const after = await engine.invoke("context.get_document", { id: "cancellation-policy-v2" });
  assert.notEqual(before.document?.sha256, after.document?.sha256);
  assert.equal(after.document?.version, "2.0.1");
  const found = await engine.invoke("context.search", { query: "freshcontextmarker" });
  assert.deepEqual(found.hits.map((hit) => hit.id), ["cancellation-policy-v2"]);
});

test("parameterized queries treat SQL and FTS syntax as input data", async (t) => {
  const { repository } = await fixture(t);
  assert.equal(await repository.get("' OR 1=1 --", signal()), null);
  assert.deepEqual(await repository.search({ query: '" ) OR * --', limit: 5 }, signal()), []);
  assert.deepEqual(await repository.search({ query: "refund", repository: "' OR 1=1 --", limit: 5 }, signal()), []);
  assert.ok(await repository.get("billing-refund-v2", signal()));
});

test("runtime opens SQLite read-only and checks cancellation before opening it", async (t) => {
  const { databasePath } = await fixture(t);
  const modes: boolean[] = [];
  const repository = sqliteContextRepository.create({ databasePath }, {
    openDatabase(path, options) {
      modes.push(options.readOnly);
      return new DatabaseSync(path, options);
    },
  }).ports.contextRepository;
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(repository.get("billing-refund-v2", controller.signal), { name: "AbortError" });
  assert.deepEqual(modes, []);
  await repository.get("billing-refund-v2", signal());
  assert.deepEqual(modes, [true]);
});

test("seed is repeatable and preserves database records updated by its owner", async (t) => {
  const { databasePath } = await fixture(t);
  const db = new DatabaseSync(databasePath);
  let count: unknown;
  try {
    count = db.prepare("SELECT count(*) AS count FROM context_documents").get()?.count;
    db.prepare("UPDATE context_documents SET version = ? WHERE id = ?").run("9.0.0", "billing-refund-v2");
  } finally { db.close(); }
  await seedContextDatabase({ databasePath, corpusRoot, schemaPath });
  const check = new DatabaseSync(databasePath);
  try {
    assert.equal(check.prepare("SELECT count(*) AS count FROM context_documents").get()?.count, count);
    assert.equal(check.prepare("SELECT version FROM context_documents WHERE id = ?").get("billing-refund-v2")?.version, "9.0.0");
  } finally { check.close(); }
});
