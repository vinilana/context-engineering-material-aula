import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
// @ts-expect-error Instructor utilities are plain ESM scripts.
import { checkParity, filesAt } from "../check-parity.mjs";
// @ts-expect-error Instructor utilities are plain ESM scripts.
import { prepareLab } from "../prepare.mjs";

test("baseline and documented scenario contain identical application and test code", async () => {
  assert.ok(await checkParity() > 10);
});

test("exports isolated repos and configures MCP exclusively in the third scenario", async (t) => {
  const temporary = await mkdtemp(join(tmpdir(), "pronto-export-test-"));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const destination = join(temporary, "demo");
  const result = await prepareLab({ destination, mcpUrl: "http://127.0.0.1:3334/mcp" });
  assert.equal(result.scenarios.length, 3);
  const baseline = await filesAt(resolve(destination, "01-sem-contexto")) as string[];
  assert.ok(!baseline.some((file) => /\.md$/.test(file)));
  assert.ok(!baseline.some((file) => /context-mcp|data\/seed|lab\//.test(file)));
  await assert.rejects(access(resolve(destination, "02-com-contexto/.mcp.json")));
  const third = resolve(destination, "03-com-mcp");
  const config = JSON.parse(await readFile(resolve(third, ".mcp.json"), "utf8"));
  assert.deepEqual(config.mcpServers["pronto-context"], { type: "http", url: "http://127.0.0.1:3334/mcp" });
  const toml = await readFile(resolve(third, ".codex/config.toml"), "utf8");
  assert.match(toml, /mcp_servers\.pronto-context/);
  assert.match(toml, /url = "http:\/\/127.0.0.1:3334\/mcp"/);
  assert.ok(!toml.includes("command ="));
  for (const scenario of result.scenarios) await access(resolve(scenario.path, ".git/HEAD"));
  await assert.rejects(prepareLab({ destination }), { code: "EEXIST" });
});
