import { DatabaseSync } from "node:sqlite";
import { mkdir, readFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { z } from "zod";
import { metadataSchema } from "../domain/context-document.js";

export async function seedContextDatabase(options: { databasePath: string; corpusRoot: string; schemaPath: string }) {
  const root = resolve(options.corpusRoot);
  const manifest = z.object({ documents: z.array(metadataSchema) }).parse(
    JSON.parse(await readFile(resolve(root, "catalog.json"), "utf8")),
  );
  const documents = await Promise.all(manifest.documents.map(async (metadata) => {
    const filename = resolve(root, metadata.path);
    const inside = relative(root, filename);
    if (inside === ".." || inside.startsWith(`..${sep}`) || isAbsolute(inside)) throw new Error("Seed document outside corpus");
    const content = await readFile(filename, "utf8");
    if (Buffer.byteLength(content) > 32_000) throw new Error("Seed document exceeds size limit");
    return { ...metadata, content };
  }));
  const schema = await readFile(options.schemaPath, "utf8");
  await mkdir(dirname(resolve(options.databasePath)), { recursive: true });
  const db = new DatabaseSync(options.databasePath);
  try {
    const version = db.prepare("PRAGMA user_version").get()?.user_version;
    if (version !== 0 && version !== 1) throw new Error("Unsupported context database schema");
    db.exec("BEGIN IMMEDIATE");
    try {
      db.exec(schema);
      const insert = db.prepare(`INSERT INTO context_documents
        (id, title, repository, kind, path, uri, owner, version, updated_at, status, superseded_by, keywords, summary, content)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING`);
      for (const doc of documents) {
        insert.run(doc.id, doc.title, doc.repository, doc.kind, doc.path, doc.uri, doc.owner,
          doc.version, doc.updatedAt, doc.status, doc.supersededBy, JSON.stringify(doc.keywords), doc.summary, doc.content);
      }
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
    return { databasePath: resolve(options.databasePath), documents: Number(db.prepare("SELECT count(*) AS count FROM context_documents").get()?.count) };
  } finally { db.close(); }
}
