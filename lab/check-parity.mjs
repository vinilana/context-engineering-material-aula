import { readdir, readFile } from "node:fs/promises";
import { resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

export const labRoot = fileURLToPath(new URL("../", import.meta.url));
const ignored = new Set(["node_modules", "dist", ".git"]);
const contextFiles = new Set(["AGENTS.md", "CLAUDE.md"]);

export async function filesAt(root) {
  const files = [];
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (ignored.has(entry.name)) continue;
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) await walk(path);
      else files.push(relative(root, path));
    }
  }
  await walk(root);
  return files.sort();
}

export async function checkParity() {
  const first = resolve(labRoot, "scenarios/01-sem-contexto");
  const second = resolve(labRoot, "scenarios/02-com-contexto");
  const firstFiles = await filesAt(first);
  assert.ok(!firstFiles.some((file) => /\.(md|mdx|rst|txt)$/i.test(file)), "Baseline must not contain documentation");
  const secondFiles = (await filesAt(second)).filter((file) => !contextFiles.has(file.split("/").at(-1)));
  assert.deepEqual(secondFiles, firstFiles, "Scenarios must contain the same non-context files");
  for (const file of firstFiles) {
    assert.deepEqual(await readFile(resolve(first, file)), await readFile(resolve(second, file)), `Code differs: ${file}`);
  }
  return firstFiles.length;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const count = await checkParity();
  console.log(`Paridade confirmada: ${count} arquivos idênticos; cenário 02 acrescenta apenas AGENTS.md e CLAUDE.md.`);
}
