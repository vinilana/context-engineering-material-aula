# Regras para alterações no domínio

- Preservar as instruções de `../../AGENTS.md`.
- Usar funções de transição explícitas e manter estados terminais sem saídas.
- Não importar Zod, HTTP, gateways ou repositórios nesta pasta.
- Receber o instante atual como argumento; não ler relógio dentro de regras.
- Guardar totais e snapshots originais mesmo após mudanças de estado.
- Novo estado exige revisar o tipo, a tabela de transições e testes de comportamento.
- Políticas entre serviços precisam de fonte externa identificada; não inferir
  elegibilidade de estorno apenas pelo nome de um estado.
