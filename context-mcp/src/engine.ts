import { createEngine } from "@invokta/core";
import type { ContextRepository } from "./application/ports.js";
import { createSearchContext } from "./capabilities/search-context.js";
import { createGetDocument } from "./capabilities/get-document.js";
import { createPrepareTask } from "./capabilities/prepare-task.js";
import { readContextConfig } from "./context-config.js";
import { createSqliteContextRepository } from "./infrastructure/sqlite-context-repository.js";

export function createContextEngine(dependencies?: { contextRepository: ContextRepository }) {
  const contextRepository = dependencies?.contextRepository
    ?? createSqliteContextRepository({ databasePath: readContextConfig().databasePath }).ports.contextRepository;

  return createEngine({
    name: "pronto-context-engine",
    version: "1.0.0",
    capabilities: {
      "context.search": createSearchContext(contextRepository),
      "context.get_document": createGetDocument(contextRepository),
      "context.prepare_task": createPrepareTask(contextRepository),
    },
  });
}

export const engine = createContextEngine();
