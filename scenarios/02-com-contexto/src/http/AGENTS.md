# Regras para alterações na API

- Preservar as instruções de `../../AGENTS.md`.
- Validar a entrada na borda com schema Zod estrito.
- Manter regras de negócio na aplicação/domínio; rotas só fazem a tradução HTTP.
- Não aceitar total monetário calculado pelo cliente.
- Manter `createHttpServer` sem abrir portas: quem chama decide onde escutar.
- Testar novos endpoints pela API, inclusive entrada inválida e erros de negócio.
- Para operações com efeito externo, confirmar contrato de idempotência e retry
  antes de escolher headers, payloads ou códigos de resposta.
