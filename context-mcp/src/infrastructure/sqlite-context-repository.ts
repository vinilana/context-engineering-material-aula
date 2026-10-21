import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { defineConnector } from "@invokta/core";
import { z } from "zod";
import type { ContextRepository } from "../application/ports.js";
import { documentSchema, metadataSchema } from "../domain/context-document.js";
import { contextSearchTerms } from "../domain/context-search.js";

const columns = `d.id, d.title, d.repository, d.kind, d.path, d.uri, d.owner,
  d.version, d.updated_at AS updatedAt, d.status, d.superseded_by AS supersededBy,
  d.keywords, d.summary`;

function parseMetadata(row: Record<string, unknown>) {
  return metadataSchema.parse({ ...row, keywords: JSON.parse(String(row.keywords)) });
}

export const sqliteContextRepository = defineConnector({
  name: "sqlite-context-repository",
  config: z.object({ databasePath: z.string().min(1) }).strict(),
  create(config, dependencies: {
    openDatabase: (path: string, options: { readOnly: boolean; timeout: number }) => DatabaseSync;
  }) {
    const databasePath = resolve(config.databasePath);

    function read<T>(signal: AbortSignal, operation: (db: DatabaseSync) => T): T {
      signal.throwIfAborted();
      let db: DatabaseSync | undefined;
      try {
        db = dependencies.openDatabase(databasePath, { readOnly: true, timeout: 500 });
        db.exec("PRAGMA query_only = ON");
        if (db.prepare("PRAGMA user_version").get()?.user_version !== 1) throw new Error("Unsupported context schema");
        const result = operation(db);
        signal.throwIfAborted();
        return result;
      } catch {
        signal.throwIfAborted();
        throw new Error("Context database is unavailable or incompatible.");
      } finally {
        db?.close();
      }
    }

    const contextRepository: ContextRepository = {
      async get(id, signal) {
        return read(signal, (db) => {
          const row = db.prepare(`SELECT ${columns}, d.content FROM context_documents d WHERE d.id = ?`).get(id);
          if (!row) return null;
          const content = String(row.content);
          if (Buffer.byteLength(content) > 32_000) throw new Error("Context document exceeds size limit");
          const metadata = parseMetadata(row);
          return documentSchema.parse({
            ...metadata,
            content,
            sha256: createHash("sha256").update(content).digest("hex"),
            warning: metadata.status === "deprecated" ? `Obsoleto. Consulte ${metadata.supersededBy ?? "o responsável pela fonte"}.` : null,
          });
        });
      },
      async search(input, signal) {
        signal.throwIfAborted();
        const terms = contextSearchTerms(input.query);
        if (terms.length === 0) return [];
        const match = terms.map((term) => `"${term}"`).join(" OR ");
        return read(signal, (db) => {
          const rows = db.prepare(`
            SELECT ${columns}, -bm25(context_documents_fts, 6, 1, 8, 4, 1) AS score,
              snippet(context_documents_fts, 4, '', '', ' … ', 35) AS excerpt
            FROM context_documents_fts JOIN context_documents d ON d.rowid = context_documents_fts.rowid
            WHERE context_documents_fts MATCH ?
              AND (? = 1 OR d.status = 'active')
              AND (? IS NULL OR d.repository = ?)
            ORDER BY score DESC, d.id ASC LIMIT ?
          `).all(match, input.includeDeprecated ? 1 : 0, input.repository ?? null, input.repository ?? null, input.limit);
          return rows.map((row) => ({
            ...parseMetadata(row),
            score: Number(row.score),
            excerpt: String(row.excerpt).slice(0, 400),
          }));
        });
      },
    };
    return { ports: { contextRepository } };
  },
});

export function createSqliteContextRepository(config: { databasePath: string }) {
  return sqliteContextRepository.create(config, {
    openDatabase: (path, options) => new DatabaseSync(path, options),
  });
}
