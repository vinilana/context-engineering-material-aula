# Padrões gerais de engenharia

Vigente desde 2026-10-21. Responsável: Engineering Enablement.
Aplicável a todos os serviços, independentemente do repositório.

- Contratos entre serviços precisam de dono, versão e critérios de compatibilidade.
- Registrar decisões de arquitetura e suas consequências antes de mudar fronteiras.
- Uma política compartilhada deve ter uma fonte responsável; consumidores consultam
  a versão vigente, evitando cópias de regras sem controle de atualização.
- Mudanças de contratos exigem verificar consumidores e testes de compatibilidade.
- Eventos devem incluir identificador estável, versão e instante do fato.
- Evitar dados pessoais em payloads que não precisem dessas informações.
- Validar entrada na borda e observar as falhas das dependências.
- Conhecimento recuperado para uma tarefa precisa de proveniência e data de revisão.

O banco de contexto é mantido por um processo externo de curadoria ou ingestão.
A engine MCP consulta esses registros. Ela não reindexa automaticamente os
repositórios nem determina sozinha se uma informação representa o estado atual.
