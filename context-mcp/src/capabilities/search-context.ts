import { defineCapability } from "@invokta/core";
import { z } from "zod";
import type { ContextRepository } from "../application/ports.js";
import { metadataSchema } from "../domain/context-document.js";

const hitSchema = metadataSchema.extend({ score: z.number(), excerpt: z.string() });

const annotations = { readOnly: true, destructive: false, idempotent: true, openWorld: false };

export function createSearchContext(contextRepository: ContextRepository) {
  return defineCapability({
    title: "Buscar contexto entre repositórios e políticas",
    description: "Consulta o banco SQLite de contexto com busca textual FTS5: arquitetura de repositórios, padrões de implementação, contratos de serviços e políticas gerais. Retorna fonte, owner, versão, data e trecho. Por padrão exclui documentos obsoletos. Leia os documentos antes de aplicar regras.",
    input: z.object({
      query: z.string().trim().min(1).max(2000),
      repository: z.string().min(1).optional(),
      includeDeprecated: z.boolean().default(false),
      limit: z.number().int().min(1).max(10).default(5),
    }).strict(),
    output: z.object({ hits: z.array(hitSchema), notice: z.string() }),
    access: "public",
    timeoutMs: 5000,
    annotations,
    async run({ input, context }) {
      return {
        hits: await contextRepository.search(input, context.signal),
        notice: "Busca textual FTS5 no SQLite de contexto; ausência de resultados não prova ausência de uma regra. Confira fonte, versão e data de revisão.",
      };
    },
  });
}
