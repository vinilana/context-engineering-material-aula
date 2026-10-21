# Pronto Delivery — padrões de implementação

Snapshot revisado em 2026-10-21. Responsável: equipe de engenharia do Pronto Delivery.

## Arquitetura e dependências

Usar injeção explícita por construtor e funções de composição. Regras de negócio
ficam no domínio e na aplicação; handlers HTTP fazem validação e tradução.
Não importar infraestrutura ou HTTP para o domínio. Relógio e gerador de IDs são
dependências substituíveis. Adapters não são fontes de políticas corporativas.

## Valores e estado

Dinheiro usa inteiros em centavos de BRL. Preços são obtidos do catálogo no servidor.
Guardar nome e preço dos itens como snapshot e preservar totais históricos.
As transições seguem `placed → confirmed → preparing → dispatched → delivered`.
O repositório devolve cópias para evitar mutação indireta de dados persistidos.

## Erros e testes

Usar `DomainError(code, message, statusCode)` para falhas de negócio.
O envelope HTTP é `{ error: { code, message } }`. Validar entradas com Zod estrito.
Usar 422 para entrada inválida, 404 para recurso ausente e 409 para conflito.
Testar comportamento observável, falhas e limites relevantes. Integrações HTTP
usam porta efêmera. Spies verificam payloads enviados a serviços externos.
