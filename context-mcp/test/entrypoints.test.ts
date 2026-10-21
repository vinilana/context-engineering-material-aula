import { test } from "vitest";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { DatabaseSync } from "node:sqlite";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { seedContextDatabase } from "../src/infrastructure/seed-sqlite-context.js";
import { createHttpAuth } from "../src/http-auth.js";

// The SDK's HTTP sessionId property is wider than its shared Transport declaration
// under exactOptionalPropertyTypes; both types describe the same SDK transport.
function httpTransport(...args: ConstructorParameters<typeof StreamableHTTPClientTransport>) {
  return new StreamableHTTPClientTransport(...args) as Parameters<Client["connect"]>[0];
}

async function startServer(t: { onTestFinished: (cleanup: () => Promise<void>) => void }, authenticated = false) {
  const directory = await mkdtemp(join(tmpdir(), "pronto-http-test-"));
  const databasePath = join(directory, "context.sqlite");
  await seedContextDatabase({
    databasePath,
    corpusRoot: fileURLToPath(new URL("../data/seed/", import.meta.url)),
    schemaPath: fileURLToPath(new URL("../data/schema.sql", import.meta.url)),
  });
  const child = spawn(process.execPath, [fileURLToPath(new URL("../dist/mcp-http.js", import.meta.url))], {
    cwd: directory,
    env: { ...process.env, CONTEXT_DB_PATH: databasePath, INVOKTA_HTTP_HOST: "127.0.0.1", INVOKTA_HTTP_PORT: "0", INVOKTA_HTTP_AUTH_MODE: authenticated ? "required" : "development", CONTEXT_MCP_TOKEN: "test-context-reader-token" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  t.onTestFinished(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      const closed = once(child, "exit");
      child.kill("SIGTERM");
      await closed;
    }
    await rm(directory, { recursive: true, force: true });
  });
  const url = await new Promise<string>((resolve, reject) => {
    let output = "";
    const timer = setTimeout(() => reject(new Error("HTTP startup timed out")), 8000);
    child.once("error", (error) => { clearTimeout(timer); reject(error); });
    child.once("exit", () => { clearTimeout(timer); reject(new Error("HTTP process exited before startup")); });
    child.stderr.on("data", (chunk: Buffer) => {
      output += chunk.toString();
      const match = /MCP endpoint: (http:\/\/\S+)/.exec(output);
      if (match?.[1]) { clearTimeout(timer); resolve(match[1]); }
    });
  });
  return { url, databasePath };
}

test("real MCP HTTP discovers tools and reads live SQLite updates from an unrelated cwd", async (t) => {
  const { url, databasePath } = await startServer(t);
  const client = new Client({ name: "http-lab-test", version: "1.0.0" });
  t.onTestFinished(() => client.close());
  await client.connect(httpTransport(new URL(url)));
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map((tool) => tool.name).sort(), ["context_get_document", "context_prepare_task", "context_search"]);
  assert.ok(tools.every((tool) => tool.annotations?.readOnlyHint));
  const result = await client.callTool({ name: "context_prepare_task", arguments: { task: "cancelamento estorno logística" } });
  assert.ok(!result.isError);
  assert.equal((result.structuredContent as { documents: unknown[] }).documents.length, 3);
  const db = new DatabaseSync(databasePath);
  try {
    db.prepare("UPDATE context_documents SET content = content || ?, version = ? WHERE id = ?")
      .run("\nFresh HTTP database update.\n", "2.0.1", "cancellation-policy-v2");
  } finally { db.close(); }
  const updated = await client.callTool({ name: "context_get_document", arguments: { id: "cancellation-policy-v2" } });
  const document = (updated.structuredContent as { document: { version: string; content: string } }).document;
  assert.equal(document.version, "2.0.1");
  assert.match(document.content, /Fresh HTTP database update/);
  const invalid = await client.callTool({ name: "context_search", arguments: { query: "refund", limit: -1 } });
  assert.equal(invalid.isError, true);
}, 15000);

test("authenticated HTTP rejects missing or invalid credentials and accepts a valid reader", async (t) => {
  const { url } = await startServer(t, true);
  for (const headers of [{}, { authorization: "Bearer wrong-token" }]) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream", ...headers },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    });
    assert.equal(response.status, 401);
    await response.text();
  }
  const client = new Client({ name: "authenticated-test", version: "1.0.0" });
  t.onTestFinished(() => client.close());
  await client.connect(httpTransport(new URL(url), { requestInit: { headers: { authorization: "Bearer test-context-reader-token" } } }));
  assert.equal((await client.listTools()).tools.length, 3);
}, 15000);

test("authentication fails closed unless development mode is explicitly confined to loopback", () => {
  assert.throws(() => createHttpAuth({ mode: "required", host: "127.0.0.1" }), /CONTEXT_MCP_TOKEN/);
  assert.throws(() => createHttpAuth({ mode: "development", host: "0.0.0.0" }), /loopback/);
  assert.throws(() => createHttpAuth({ mode: "unknown", host: "127.0.0.1" }), /AUTH_MODE/);
});
