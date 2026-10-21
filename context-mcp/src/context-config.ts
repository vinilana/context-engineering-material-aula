import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export function readContextConfig(environment: NodeJS.ProcessEnv = process.env) {
  const defaultPath = fileURLToPath(new URL("../data/context.sqlite", import.meta.url));
  const configured = environment.CONTEXT_DB_PATH;
  if (configured !== undefined && configured.trim() === "") throw new Error("CONTEXT_DB_PATH must not be empty");
  return { databasePath: resolve(configured ?? defaultPath) };
}
