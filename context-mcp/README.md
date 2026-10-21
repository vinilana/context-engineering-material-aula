# Pronto Context Engine

An Invokta Action Engine that serves curated repository knowledge from SQLite over
MCP Streamable HTTP. The project follows the official `mcp-http` scaffold from
`create-invokta-engine@0.9.0`.

## Run the laboratory

From the laboratory root:

```sh
npm ci
npm run check
npm run context:seed
npm run mcp
```

The last command starts a loopback-only demonstration server at
`http://127.0.0.1:3334/mcp`. Keep it running while using the third scenario.
Clients connect to that URL; they do not launch a stdio process or open SQLite.
Run one server per port. If an instance is already listening, startup identifies
the occupied port; stop that instance before starting another one.

The engine uses Node's built-in `node:sqlite`, available in the supported
Node.js >=22.20 runtime, with no separate database server or native npm driver.

## SQLite as the context source

`data/context.sqlite` is prepopulated with seven fictional records: a repository
map, implementation patterns, general engineering standards, two service
contracts, the current business policy and its deprecated predecessor.

Runtime uses only SQLite. `data/seed/` contains reproducible seed inputs;
the MCP process does not read these files. Changes to seed files do not change
the runtime database.

The engine opens read-only connections for each query, bounds the SQLite busy
wait, validates stored metadata, and returns document hashes. Changes committed
by an external writer are visible in subsequent calls without restarting the
server. Repository indexing and maintenance are separate processes; the engine
does not claim to detect repository changes or certify that a record is current.

`data/schema.sql` defines the storage contract:

- `context_documents` holds IDs, repository, kind, source URI/path, owner, version,
  review date, status, replacement ID, keywords, summary and content.
- `context_documents_fts` indexes title, repository, keywords, summary and content
  with FTS5 and accent-insensitive tokenization.
- Insert, update and delete triggers keep the full-text index synchronized.
- `PRAGMA user_version = 1` identifies the supported schema.

The schema supports repository knowledge, standards, contracts, policies and
architecture decisions. Search uses bound SQL parameters and quoted literal
terms, with BM25 ranking. Deprecated records are excluded by default. This is
text retrieval, not semantic search or a guarantee of sufficient context.

To initialize another database, set `CONTEXT_DB_PATH` and run `npm run db:seed`
after building. Seed adds missing fixture records and preserves existing rows,
including records updated by their owner. It does not overwrite current records
or synchronize changed seed files into an existing database.

For example, an external updater can change a record using a prepared statement:

```js
import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync(process.env.CONTEXT_DB_PATH);
try {
  db.prepare(`UPDATE context_documents
    SET content = ?, version = ?, updated_at = ? WHERE id = ?`)
    .run('Reviewed implementation guidance.', '1.0.1', '2026-10-21',
      'pronto-implementation-patterns');
} finally {
  db.close();
}
```

The next MCP query sees that committed content and a new SHA-256. Data owners
must maintain version, date and status alongside their content.

## HTTP configuration

The generated `src/env.ts` loads an optional `.env` from the process working
directory. Existing environment variables take precedence. `.env.example` lists
settings; the main ones are:

| Variable | Purpose |
| --- | --- |
| `CONTEXT_DB_PATH` | SQLite path; defaults to `data/context.sqlite` relative to this package |
| `INVOKTA_HTTP_HOST` | Bind host; default `127.0.0.1` |
| `INVOKTA_HTTP_PORT` / `PORT` | HTTP port; default `3000` in the HTTP scaffold |
| `INVOKTA_HTTP_AUTH_MODE` | `required` by default, or explicit `development` on loopback |
| `CONTEXT_MCP_TOKEN` | Bearer token required by authenticated HTTP |
| `INVOKTA_HTTP_ALLOWED_HOSTS` | Host allowlist required for a non-loopback bind |
| `INVOKTA_HTTP_ALLOWED_ORIGINS` | Optional browser origin allowlist |

`npm run mcp:demo` explicitly sets loopback, port 3334 and development mode for
the fictional laboratory. `npm run mcp:http` uses normal environment settings and
requires a token unless development mode was explicitly selected. Development
mode refuses non-loopback binds. Authenticated clients send
`Authorization: Bearer <token>`; missing or invalid credentials receive HTTP 401.
Startup verifies that the database exists and has the expected schema before
announcing the endpoint. The reader never creates or seeds a database.

The deployment manifest is `invokta.deploy.json`; the generated packaging and
probe commands remain available. Deployment needs the maintained SQLite file
mounted in the runtime with `CONTEXT_DB_PATH` pointing to it. Neither the database
nor credentials are bundled into the deployment package. No deployment is
performed by the laboratory scripts.

## Architecture and commands

```text
.agents/skills/develop-invokta-project/
AGENTS.md
CLAUDE.md -> AGENTS.md
.env.example
invokta.deploy.json
package.json
tsconfig.json
tsconfig.test.json
data/
  schema.sql
  context.sqlite
  seed/                 reproducible initial context records
src/
  application/ports.ts
  capabilities/
    search-context.ts
    get-document.ts
    prepare-task.ts
  domain/
    context-document.ts
    context-search.ts
  infrastructure/
    sqlite-context-repository.ts
    seed-sqlite-context.ts
  context-config.ts
  engine.ts
  direct.ts
  seed.ts
  env.ts
  http-auth.ts
  mcp-http.ts
test/
  engine.test.ts
  sqlite-context-repository.test.ts
  entrypoints.test.ts
```

Capabilities depend on the engine-owned `ContextRepository` port. The SQLite
implementation uses `defineConnector` with private validated configuration and
performs no I/O during construction. `engine.ts` composes the dependencies and
registers the three stable capabilities. Both direct and HTTP execution use the
same invocation pipeline. The separate seed entrypoint is an administrative
fixture loader, not an MCP write capability.

| Invokta ID | MCP alias | Purpose |
| --- | --- | --- |
| `context.search` | `context_search` | Find repository context, standards, contracts and policies |
| `context.get_document` | `context_get_document` | Read a complete record with provenance and SHA-256 |
| `context.prepare_task` | `context_prepare_task` | Gather an initial set of current records for a task |

Within this workspace:

```sh
npm run check
npm run direct -- "arquitetura padrões"
npm run devtools
npm run devtools:doctor
npm run check:mcp
```

Tests use fresh SQLite databases and a real HTTP MCP client. They cover live
updates, the FTS index, repository filters, obsolete records, parameter binding,
read-only opens, repeated seed, authentication and HTTP tool discovery.

References: [HTTP scaffold](https://docs.invokta.dev/reference/create-invokta-engine/),
[MCP HTTP adapter](https://docs.invokta.dev/reference/mcp/) and
[SQLite FTS5](https://www.sqlite.org/fts5.html).
