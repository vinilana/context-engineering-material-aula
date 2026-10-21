import "./env.js";
import { fileURLToPath } from "node:url";
import { readContextConfig } from "./context-config.js";
import { seedContextDatabase } from "./infrastructure/seed-sqlite-context.js";

const result = await seedContextDatabase({
  databasePath: readContextConfig().databasePath,
  corpusRoot: fileURLToPath(new URL("../data/seed/", import.meta.url)),
  schemaPath: fileURLToPath(new URL("../data/schema.sql", import.meta.url)),
});
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
