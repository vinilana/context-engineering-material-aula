# Pronto Delivery — mapa do repositório

Snapshot revisado em 2026-10-21. Responsável: equipe de engenharia do Pronto Delivery.

API de pedidos escrita em TypeScript estrito e ESM, executada com Node.js >=22.20.
O serviço possui domínio, aplicação, infraestrutura e borda HTTP separados.

- `src/domain/order.ts`: entidade Order e transições do ciclo de preparação.
- `src/application/order-service.ts`: criação, consulta, listagem e mudança de estado.
- `src/application/ports.ts`: contratos de repositório, catálogo, pagamentos e eventos.
- `src/infrastructure/memory.ts`: adapters em memória substituíveis nos testes.
- `src/http/server.ts`: rotas, validação Zod e tradução dos erros de domínio.
- `src/app.ts`: composição das dependências e servidor sem abrir uma porta.
- `src/server.ts`: inicialização da API em 127.0.0.1, porta definida por PORT.
- `test/order.test.ts`: testes de comportamento e integração HTTP em porta efêmera.

Comandos: `npm ci`, `npm run dev`, `npm run typecheck`, `npm test`, `npm run build`.
Dados são voláteis. A API não tem autenticação neste exercício.
Checkout, pagamentos e logística são outros domínios e têm contratos próprios.
