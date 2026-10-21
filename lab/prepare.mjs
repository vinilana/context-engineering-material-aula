import { cp, mkdir, mkdtemp, writeFile, access, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, relative, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import { checkParity, filesAt, labRoot } from "./check-parity.mjs";

const exec = promisify(execFile);

export async function prepareLab({ destination, install = false, mcpUrl = process.env.CONTEXT_MCP_URL ?? "http://127.0.0.1:3334/mcp" } = {}) {
  await checkParity();
  const endpoint = new URL(mcpUrl);
  if (!["http:", "https:"].includes(endpoint.protocol)) throw new Error("MCP URL must use HTTP or HTTPS.");
  const manifest = JSON.parse(await readFile(resolve(labRoot, "context-mcp/invokta.deploy.json"), "utf8"));
  const serverPath = resolve(labRoot, "context-mcp", manifest.entry);
  await access(serverPath);
  let output;
  if (destination) {
    output = resolve(destination);
    const fromLab = relative(labRoot, output);
    if (!fromLab || (!fromLab.startsWith("..") && !isAbsolute(fromLab))) {
      throw new Error("Escolha um destino fora deste repositório para isolar a demonstração.");
    }
    await mkdir(output);
  } else {
    output = await mkdtemp(join(tmpdir(), "pronto-context-lab-"));
  }

  const scenarios = [
    ["01-sem-contexto", "01-sem-contexto"],
    ["02-com-contexto", "02-com-contexto"],
    ["03-com-mcp", "02-com-contexto"],
  ];
  const results = [];
  for (const [name, sourceName] of scenarios) {
    const source = resolve(labRoot, "scenarios", sourceName);
    const target = resolve(output, name);
    await mkdir(target);
    for (const file of await filesAt(source)) {
      const to = resolve(target, file);
      await mkdir(resolve(to, ".."), { recursive: true });
      await cp(resolve(source, file), to);
    }
    if (name === "03-com-mcp") {
      await writeFile(resolve(target, ".mcp.json"), JSON.stringify({
        mcpServers: {
          "pronto-context": {
            type: "http",
            url: endpoint.href,
          },
        },
      }, null, 2) + "\n");
      await mkdir(resolve(target, ".codex"));
      await writeFile(resolve(target, ".codex/config.toml"), [
        "[mcp_servers.pronto-context]",
        `url = ${JSON.stringify(endpoint.href)}`,
        "startup_timeout_sec = 15",
        "tool_timeout_sec = 30",
        "",
      ].join("\n"));
    }
    await exec("git", ["init", "--quiet"], { cwd: target });
    if (install) await exec("npm", ["ci", "--no-audit", "--no-fund"], { cwd: target, maxBuffer: 1024 * 1024 });
    results.push({ scenario: name, path: target, installed: install });
  }
  return { output, mcpUrl: endpoint.href, scenarios: results };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const options = {};
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === "--install") options.install = true;
    else if (["--dest", "--mcp-url"].includes(arg) && args[index + 1] && !args[index + 1].startsWith("--")) {
      options[arg === "--dest" ? "destination" : "mcpUrl"] = args[++index];
    } else throw new Error("Uso: npm run demo:prepare -- [--dest /novo/destino] [--mcp-url http://host:3334/mcp] [--install]");
  }
  const result = await prepareLab(options);
  console.log(JSON.stringify(result, null, 2));
  console.log("Abra uma pasta por vez em uma sessão nova. O prompt comum está em lab/PROMPT.md no repositório do instrutor.");
  console.log(`Inicie a engine HTTP separadamente. Endpoint configurado: ${result.mcpUrl}`);
}
