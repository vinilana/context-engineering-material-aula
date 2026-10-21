# Guia do instrutor

## Objetivo

Mostrar três formas de obter contexto sobre o mesmo problema: inferência a partir
do código; instruções locais versionadas; recuperação de fontes externas sob demanda.
O resultado do agente é variável. Observe evidências e perguntas, sem prometer que
um modelo vai falhar ou acertar por ter recebido determinado arquivo.

Os tempos abaixo são uma sugestão de demonstração de 45–60 minutos, ajustável ao
tempo de execução do agente. Para uma sessão curta, peça primeiro o plano de
implementação e compare as fontes antes de autorizar a implementação no cliente.

## Preparação — antes de abrir o agente

1. Na raiz do laboratório, rodar `npm ci`, `npm run check`,
   `npm run context:seed` e `npm run demo:prepare -- --install`.
2. Guardar os caminhos gerados. São três repositórios Git novos, ainda sem commits.
3. Abrir uma cópia por vez em uma janela/sessão nova. Usar o mesmo modelo,
   permissões, prompt e tempo de observação nas três rodadas.
4. Conferir instruções globais, memória, conectores e diretórios adicionais que
   possam contaminar a comparação. Uma pasta separada não bloqueia acesso ao disco.
5. Em outro terminal na raiz, executar `npm run mcp` e manter o servidor ativo em
   `http://127.0.0.1:3334/mcp`. No cenário 03, verificar se as três ferramentas MCP estão disponíveis.
   No Claude Code, consultar `/mcp`; no Codex, conferir a lista de MCPs do cliente.
6. Manter este guia e `context-mcp/data/seed` na janela do instrutor. Não colar as
   respostas ou contratos no cenário sem MCP.

Não passar a solução da primeira rodada para a segunda. Cada rodada começa do
mesmo código inicial. O teste `npm run check:parity` garante isso nas fontes.

## Cenário 01 — descobrir o código (10–15 min)

Abrir `01-sem-contexto` gerado e enviar o texto de `lab/PROMPT.md`.

Observar como o agente descobre os comandos, a composição de dependências, o fluxo
do pedido e as integrações. Código e testes já são contexto; este cenário remove
documentação explícita, não remove todas as pistas do projeto.

Anotar fatos concretos: arquivos lidos, perguntas feitas, contratos inferidos,
testes executados, decisões sem fonte. Se o agente solicitar política de
cancelamento ou contrato de pagamentos, reconhecer que identificou corretamente
uma lacuna. Não é necessário forçar uma implementação errada para a demo funcionar.

## Cenário 02 — instruções por repositório e pasta (10–15 min)

Abrir `02-com-contexto` gerado em sessão nova e enviar o mesmo prompt.

Mostrar depois o `AGENTS.md` da raiz: objetivo, comandos, mapa de código e
invariantes locais. Em seguida, abrir os de `src/domain` e `src/http` para explicar
o escopo. Cada `CLAUDE.md` importa o `AGENTS.md` ao lado; o conteúdo é mantido em
uma única fonte para evitar divergência entre os clientes.

Verificar no cliente o que foi carregado; regras em arquivos são instruções ao
agente, não um mecanismo que impõe comportamento. O carregamento de subpastas e
imports depende do cliente e da versão. Os imports utilizados seguem a
[documentação do Claude Code](https://code.claude.com/docs/en/memory).

Comparar o tempo de descoberta e o respeito às convenções. O contexto local
explica que pagamentos e logística têm outras fontes responsáveis. Ele não contém
o contrato de estorno ou a política corporativa. Pedir a fonte que falta é um
resultado esperado e útil neste cenário.

## Cenário 03 — buscar contexto entre bases (15–20 min)

Abrir `03-com-mcp` gerado em sessão nova, verificar a conexão MCP e enviar o mesmo
prompt. O código inicial e as instruções locais são os mesmos do cenário 02.

O agente pode começar por:

```json
{"query":"cancelamento de pedido estorno logística"}
```

na ferramenta `context_search`, e ler os IDs retornados com `context_get_document`.
Ou pode invocar `context_prepare_task`:

```json
{"task":"Implementar cancelamento de pedido com estorno e evento de logística"}
```

Explicar a diferença entre descobrir uma fonte e usar seu conteúdo. Abrir um
resultado e apontar `repository`, `uri`, `owner`, `version`, `updatedAt`, `status`
e `sha256`. A ferramenta reúne evidências; o agente ainda precisa interpretar as
regras, conferir dependências e escolher o que aplicar.

As três fontes do exercício de cancelamento são:

| Fonte | Dono da informação | Conhecimento necessário |
| --- | --- | --- |
| `cancellation-policy-v2` | Manual corporativo | Elegibilidade, valor, retry, concorrência e falhas |
| `billing-refund-v2` | Serviço de pagamentos | `paymentId`, `amountInCents`, `currency`, motivo e idempotência |
| `logistics-cancellation-v2` | Serviço de logística | Envelope e versão do evento, campos permitidos e deduplicação |

Mostrar que a política corporativa não pertence exclusivamente ao serviço de
pedidos. Pagamentos e logística têm contratos próprios. Copiar tudo para cada
`AGENTS.md` exigiria sincronizar múltiplas cópias; o MCP permite consultar fontes
separadas quando a tarefa precisa delas.

Este laboratório usa um banco SQLite previamente preenchido. A engine consulta
esse banco em modo de leitura e publica ferramentas por MCP HTTP. O cliente
recebe registros, sem acesso direto ao arquivo SQLite. Os microserviços estão
representados por seus contratos; a API de pedidos usa adapters em memória.

Além das três fontes do exercício, buscar “arquitetura padrões” com filtro
`repository: "pronto-delivery"` para mostrar o mapa e as convenções do código.
Buscar “padrões engenharia” no manual corporativo para mostrar regras gerais que
se aplicam a vários repositórios.

As pastas de `context-mcp/data/seed` são somente insumos para criar o banco. Uma
curadoria ou pipeline externo mantém as informações atualizadas; o MCP não
reindexa repositórios automaticamente.

## Extensão opcional — fonte desatualizada (5 min)

Fazer uma busca com `includeDeprecated: true` e ler `cancellation-policy-v1`.
Ela excluía a taxa de entrega e permitia cancelamento apenas em `placed`.
A versão vigente inclui a taxa e permite `confirmed`. Mostrar `status`,
`supersededBy` e o aviso de obsolescência. A busca normal não retorna a antiga.

Também é possível atualizar um registro diretamente no SQLite, junto de sua
versão/data, seguindo o exemplo do README da engine. O conteúdo e hash mudam na
próxima consulta HTTP sem rebuild ou reinício. Editar apenas o arquivo de seed
não muda o banco que já está preenchido. Não usar
essa edição durante a comparação principal: as três rodadas devem avaliar a mesma
tarefa e as mesmas regras.

## Rubrica de observação

Preencher com evidências de cada execução, sem presumir o resultado:

| Critério | 01 | 02 | 03 |
| --- | --- | --- | --- |
| Descobriu e executou comandos de validação | | | |
| Preservou arquitetura, centavos e snapshot do pedido | | | |
| Identificou informação que não está no repositório | | | |
| Evitou inventar regras e contratos | | | |
| Consultou fontes vigentes e identificou seus responsáveis | | | |
| Implementou ou explicitou os bloqueios com precisão | | | |
| Cobriu falhas, retry e concorrência com testes | | | |

Quando houver implementação, conferir os critérios de aceitação nas fontes:

- Cancelar `placed` e `confirmed`; bloquear os estados posteriores sem efeitos.
- Exigir motivo e header válidos; manter o padrão de erros 422/404/409.
- Estornar o total original, com entrega, pelo `paymentId` correto e payload v2.
- Usar `cancel:<orderId>` como chave de negócio mesmo com outro header HTTP.
- Publicar o envelope v2, sem dados pessoais, após confirmação do estorno.
- Retry após sucesso não duplica efeitos; concorrência compartilha/serializa o fluxo.
- Falha de estorno mantém o pedido original e permite tentar de novo.
- Falha de evento conserva o estorno e retoma só a publicação, com evento estável.
- Testes usam spies/fakes que verificam os payloads: adapters de memória permissivos
  não provam conformidade com o serviço externo.
- A solução relata os limites de processo único e progresso em memória.

Não exigir comportamento financeiro definido apenas na cabeça do instrutor. As
regras avaliadas estão registradas nas fontes. O código inicial passa seus testes
porque a funcionalidade de cancelamento ainda não faz parte dele.

## Pontos para discussão

- O que pode ser inferido do código e o que exige uma fonte responsável?
- Que informação muda pouco e cabe em instruções locais?
- Que informação muda fora do repositório e deve ser consultada na origem?
- Como identificar que uma busca retornou contexto insuficiente ou obsoleto?
- Quem mantém as fontes e como uma mudança de contrato chega aos consumidores?

O MCP transporta ferramentas e resultados; a busca deste projeto usa SQLite FTS5. Ele
não fornece automaticamente busca semântica, memória, curadoria ou verdade.
Essas propriedades dependem do servidor e das fontes que o sistema oferece.
