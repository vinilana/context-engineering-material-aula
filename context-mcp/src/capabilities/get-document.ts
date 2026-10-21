import { defineCapability } from "@invokta/core";
import { z } from "zod";
import type { ContextRepository } from "../application/ports.js";
import { documentSchema } from "../domain/context-document.js";

const annotations = { readOnly: true, destructive: false, idempotent: true, openWorld: false };

export function createGetDocument(contextRepository: ContextRepository) {
  return defineCapability({
    title: "Ler documento externo por identificador",
    description: "Obtém a fonte completa por id retornado pela busca, com proveniência, versão, status e SHA-256. IDs desconhecidos retornam found=false. Não aceita caminhos de arquivo.",
    input: z.object({ id: z.string().min(1).max(200) }).strict(),
    output: z.object({ found: z.boolean(), document: documentSchema.nullable() }),
    access: "public",
    timeoutMs: 5000,
    annotations,
    async run({ input, context }) {
      const document = await contextRepository.get(input.id, context.signal);
      return { found: document !== null, document };
    },
  });
}
