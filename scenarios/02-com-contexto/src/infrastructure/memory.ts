import { randomUUID } from "node:crypto";
import type { Catalog, Dependencies, EventBus, JsonObject, OrderRepository, PaymentGateway, Product, Restaurant } from "../application/ports.js";
import type { Order } from "../domain/order.js";

export class MemoryOrderRepository implements OrderRepository {
  private readonly data = new Map<string, Order>();

  save(order: Order): void {
    this.data.set(order.id, structuredClone(order));
  }

  findById(id: string): Order | undefined {
    const order = this.data.get(id);
    return order ? structuredClone(order) : undefined;
  }

  list(): Order[] {
    return [...this.data.values()].map((order) => structuredClone(order));
  }
}

export class MemoryCatalog implements Catalog {
  constructor(
    private readonly restaurants: Restaurant[] = [
      { id: "rest-1", name: "Cozinha da Vila", deliveryFeeCents: 700, isOpen: true },
      { id: "rest-2", name: "Pizza da Esquina", deliveryFeeCents: 900, isOpen: false },
    ],
    private readonly products: Product[] = [
      { id: "prod-1", restaurantId: "rest-1", name: "Bowl da casa", priceCents: 3200, available: true },
      { id: "prod-2", restaurantId: "rest-1", name: "Suco de laranja", priceCents: 800, available: true },
      { id: "prod-3", restaurantId: "rest-1", name: "Brownie", priceCents: 1200, available: false },
      { id: "prod-4", restaurantId: "rest-2", name: "Pizza margherita", priceCents: 5500, available: true },
    ],
  ) {}

  findRestaurant(id: string): Restaurant | undefined {
    return structuredClone(this.restaurants.find((item) => item.id === id));
  }

  findProduct(id: string): Product | undefined {
    return structuredClone(this.products.find((item) => item.id === id));
  }
}

export class MemoryPayments implements PaymentGateway {
  readonly requests: JsonObject[] = [];

  async refund(request: JsonObject): Promise<{ refundId: string }> {
    this.requests.push(structuredClone(request));
    return { refundId: `refund-${this.requests.length}` };
  }
}

export class MemoryEvents implements EventBus {
  readonly messages: JsonObject[] = [];

  async publish(event: JsonObject): Promise<void> {
    this.messages.push(structuredClone(event));
  }
}

export function createDependencies(): Dependencies {
  return {
    orders: new MemoryOrderRepository(),
    catalog: new MemoryCatalog(),
    payments: new MemoryPayments(),
    events: new MemoryEvents(),
    now: () => new Date().toISOString(),
    newId: randomUUID,
  };
}
