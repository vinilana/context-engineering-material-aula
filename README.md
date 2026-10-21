# Laboratório de Context Engineering

Três demonstrações do mesmo sistema fictício de pedidos, o **Pronto Delivery**.
Stack: Node.js >= 22.20, TypeScript estrito, API HTTP e testes com `node:test`.
API de pedidos em memória e contexto em SQLite. Sem serviços pagos ou chave de LLM.

| Cenário | O que o agente recebe | O que permite observar |
| --- | --- | --- |
| 01 — sem contexto explícito | Código e testes, sem documentação | Descoberta por leitura, perguntas e suposições |
| 02 — contexto local | Mesmo código + `AGENTS.md` e `CLAUDE.md` na raiz e em subpastas | Arquitetura, invariantes e instruções por escopo |
| 03 — contexto externo | Cópia limpa do cenário 02 + MCP criado com Invokta | Busca sob demanda de contratos e políticas de outras bases |

O código e os testes dos cenários 01 e 02 são idênticos byte a byte. O terceiro
é gerado a partir do segundo. Nenhum deles contém a solução do exercício.

## Preparar

Na raiz deste repositório do instrutor:

```bash
npm ci
npm run check
npm run context:seed
npm run demo:prepare -- --install
```

O último comando cria três repositórios independentes em uma pasta temporária e
imprime seus caminhos. `--install` instala as dependências em cada cópia; pode ser
omitido para executar `npm ci` manualmente depois. Para escolher o destino:

```bash
npm run demo:prepare -- --dest /tmp/pronto-demo --install
```

O destino deve ser novo e ficar fora deste repositório. O script não sobrescreve
uma demonstração existente. Para recomeçar, gere outro destino.

Abra **somente uma pasta gerada por vez**, em uma sessão nova do agente. Este
repositório contém as respostas e as fontes do instrutor e não deve ser o workspace
do agente durante o exercício. O isolamento por pastas evita descoberta acidental;
não é um sandbox de segurança. Confira também instruções globais, memória e MCPs
já habilitados no cliente. Não use uma sessão que acompanhou os cenários anteriores.

## Demonstrar

Use o mesmo [prompt](lab/PROMPT.md) nos três cenários. O exercício é implementar
cancelamento de pedido com estorno e notificação à logística. Veja o
[guia do instrutor](lab/GUIA.md) para a sequência e a rubrica de comparação.

Dentro de uma pasta gerada:

```bash
npm run dev
```

A API escuta em `http://127.0.0.1:3000`. `PORT=3001 npm run dev` troca a porta.
O catálogo inicial contém `rest-1`, `prod-1` (R$ 32) e `prod-2` (R$ 8).
A taxa de entrega do restaurante é R$ 7. Exemplo:

```bash
curl http://127.0.0.1:3000/orders \
  -H 'Content-Type: application/json' \
  -d '{"customerId":"customer-1","restaurantId":"rest-1","paymentId":"pay-1","deliveryAddress":"Rua das Flores, 123","items":[{"productId":"prod-1","quantity":1}]}'
```

Rotas iniciais: `GET /health`, `GET /orders`, `POST /orders`, `GET /orders/:id` e
`POST /orders/:id/status`. O cancelamento ainda não está implementado.

## MCP HTTP com contexto em SQLite

A engine em [context-mcp](context-mcp/README.md) segue o scaffold oficial
`mcp-http` do Invokta. Ela consulta `context-mcp/data/context.sqlite`, um banco já
preenchido com sete registros fictícios: mapa do repositório, padrões locais,
padrões gerais, contratos de pagamentos e logística, política vigente e política
antiga. O cliente do agente conecta por HTTP; o SQLite fica no servidor.

Na raiz, depois do build e do seed, iniciar em outro terminal:

```bash
npm run mcp
```

Endpoint da demonstração: **http://127.0.0.1:3334/mcp**. Esse comando usa o modo de
laboratório restrito à interface local. Para HTTP com token e configuração de
host/porta, usar `npm run mcp:http` e seguir o [README da engine](context-mcp/README.md).

O gerador escreve `.mcp.json` para Claude Code e `.codex/config.toml` para Codex,
ambos com a URL HTTP. Não instala um processo stdio nem copia o banco para a pasta
do aluno. Para outro endereço:

```bash
npm run demo:prepare -- --mcp-url http://127.0.0.1:4444/mcp --install
```

A engine precisa estar executando no endereço configurado. O gerador não inicia
nem publica o servidor e não altera configurações globais dos clientes.

| Ferramenta MCP | Uso |
| --- | --- |
| `context_search` | Buscar no SQLite por assunto, com filtro opcional de repositório e obsoletos |
| `context_get_document` | Ler um registro por ID com versão, responsável, data e SHA-256 |
| `context_prepare_task` | Reunir registros vigentes relevantes para uma tarefa |

Os IDs Invokta continuam `context.search`, `context.get_document` e
`context.prepare_task`. Exemplos para enviar ao agente:

- Buscar “arquitetura padrões” com `repository: "pronto-delivery"`.
- Buscar “cancelamento estorno logística” entre as várias bases.
- Ler uma fonte retornada e conferir sua versão e origem antes de implementar.

Também é possível consultar a mesma engine por chamada direta:

```bash
npm run context:query -- "cancelar pedido com estorno e evento de logística"
```

A busca usa SQLite FTS5 e ranking BM25, sem embeddings. O runtime abre o banco em
modo de leitura a cada consulta. Uma atualização confirmada no SQLite aparece na
próxima chamada, sem rebuild ou reinício do MCP. O índice FTS é mantido por triggers.
Isso não significa atualização automática a partir do código: a curadoria ou
pipeline que mantém o banco é uma etapa separada.

[context-mcp/data/seed](context-mcp/data/seed) contém os insumos reproduzíveis do seed.
Esses arquivos não são consultados durante as chamadas MCP. `npm run context:seed`
adiciona registros ausentes e preserva registros já atualizados no banco; editar um
arquivo de seed não altera um registro existente. O schema e o processo de carga
estão descritos no [README da engine](context-mcp/README.md).

## Estrutura e limites

```text
scenarios/
  01-sem-contexto/       código, testes e configuração de build; nenhuma documentação
  02-com-contexto/       mesmos arquivos + instruções locais
context-mcp/            engine Invokta, SQLite preenchido e MCP HTTP
  data/seed/            insumos do seed: repositório, padrões, contratos e políticas
lab/                    gerador, prompt, guia e verificação de paridade
```

Os adapters de pagamento e eventos apenas registram chamadas em memória. Não
validam os contratos externos por conta própria. Reiniciar a API apaga os dados;
não há autenticação, broker, persistência durável ou estorno real. O modo MCP de laboratório
serve dados fictícios em loopback; o modo HTTP normal exige Bearer token. A implementação de
produção desses componentes fica fora do laboratório.

Referências consultadas em 2026-10-21:
[primeiro engine Invokta](https://docs.invokta.dev/getting-started/first-engine/),
[adapter MCP Invokta](https://docs.invokta.dev/reference/mcp/),
[MCP no Codex](https://developers.openai.com/codex/mcp/),
[MCP no Claude Code](https://code.claude.com/docs/en/mcp) e
[imports de contexto no Claude Code](https://code.claude.com/docs/en/memory).
