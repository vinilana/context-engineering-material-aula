# Project Instructions

## Language

Write all project content in English, including documentation, source comments,
public errors, examples, tests, commits, and release notes.

## Architecture

- Define domain actions as capabilities with explicit input, output, access, and execution contracts.
- Keep the generated direct, MCP HTTP entry points on the single `engine.invoke` path.
- Keep models, prompts, providers, data stores, and tools behind replaceable engine-owned dependencies.
- Use `defineConnector` for provider- or technology-specific outbound integrations and inject only their engine-owned ports into capabilities.
- Keep connector configuration and clients at the composition root; connector construction performs no external I/O.
- Keep business logic out of `src/direct.ts`, `src/mcp-http.ts`.
- Do not add framework-wide registries, service locators, or adapter-specific business logic.
- Keep HTTP authentication fail-closed until `src/http-auth.ts` verifies a real credential.

## Delivery

- Follow RED, GREEN, REFACTOR for executable behavior.
- Run `npm run check` before completing a change.
- Keep `CLAUDE.md` as a symbolic link to this file so agent instructions have one source of truth.
