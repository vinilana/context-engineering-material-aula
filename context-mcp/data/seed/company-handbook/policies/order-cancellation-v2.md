# Cancelamento de pedidos — política 2.0.0

Vigente desde 2026-10-15. Responsáveis: Customer Experience e Finance.
Substitui a política 1.0.0. Aplica-se a pedidos com pagamento já capturado.

## Elegibilidade e resposta

1. O cliente pode cancelar pedidos nos estados `placed` e `confirmed`.
2. `preparing`, `dispatched` e `delivered` não permitem cancelamento pelo cliente:
   responder HTTP 409 com `CANCELLATION_NOT_ALLOWED`, sem estorno ou evento.
3. A entrada de `POST /orders/:id/cancel` é `{ "reason": "CUSTOMER_REQUEST" }`.
   Outros motivos ou campos extras são inválidos (422).
4. A requisição exige header `Idempotency-Key` não vazio (máximo 100 caracteres).
   Ausente ou inválido: HTTP 422 com `VALIDATION_ERROR`.
5. Pedido inexistente: HTTP 404 com `ORDER_NOT_FOUND`.
6. Cancelamento concluído: HTTP 200 com o pedido em `cancelled`, `cancelledAt`
   em ISO-8601 e `refundId` retornado por pagamentos. Preservar itens e totais.

## Dinheiro e contratos entre serviços

Estornar **o total pago, inclusive a taxa de entrega**, usando `order.totalCents`.
Não recalcular pelo catálogo atual. Valores em centavos de BRL.

Consultar `billing-refund-v2` para o payload de estorno e
`logistics-cancellation-v2` para o evento. `orderId` e `paymentId` são distintos.
Não enviar endereço, identificação de cliente ou itens para a logística neste evento.

## Ordem, repetição e falhas

- Validar elegibilidade antes de produzir efeitos externos.
- A chave de negócio do cancelamento é `cancel:<orderId>`; não depende do header.
  Dois headers diferentes para o mesmo pedido não criam dois estornos.
- Solicitar estorno, persistir estado de estorno/cancelamento e evento pendente,
  publicar evento e registrar publicação concluída. A implementação didática pode
  guardar esse progresso em memória e deve documentar a perda ao reiniciar.
- Falha de pagamentos: responder 502 com `REFUND_UNAVAILABLE`. O pedido mantém
  o estado original, nenhum evento é publicado e uma nova tentativa é permitida.
- Falha ao publicar após estorno: responder 502 com `EVENT_PUBLISH_UNAVAILABLE`.
  Preservar `refundId` e o evento pendente. Retry retoma apenas publicação.
- Após conclusão, repetir o cancelamento retorna 200 com o mesmo `refundId` e
  `cancelledAt`, sem novo estorno ou publicação. Vale também para header diferente.
- Chamadas simultâneas do mesmo pedido precisam compartilhar/serializar a operação.
- O evento usa identidade estável: não gerar um novo `eventId` em cada retry.

## Limite deste exercício

O laboratório é de processo único, sem banco, broker ou rede de pagamentos.
Um controle em memória pode demonstrar retry e concorrência nesse processo.
Em produção seria necessário progresso durável, outbox e idempotência no provedor.
Não prometer entrega exactly-once: um broker pode aceitar a mensagem e perder a
confirmação; o consumidor precisa deduplicar por `eventId`.
