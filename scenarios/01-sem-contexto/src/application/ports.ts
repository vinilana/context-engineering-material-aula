import type { Order } from "../domain/order.js";

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

export interface Product {
  id: string;
  restaurantId: string;
  name: string;
  priceCents: number;
  available: boolean;
}

export interface Restaurant {
  id: string;
  name: string;
  deliveryFeeCents: number;
  isOpen: boolean;
}

export interface OrderRepository {
  save(order: Order): void;
  findById(id: string): Order | undefined;
  list(): Order[];
}

export interface Catalog {
  findRestaurant(id: string): Restaurant | undefined;
  findProduct(id: string): Product | undefined;
}

export interface PaymentGateway {
  refund(request: JsonObject): Promise<{ refundId: string }>;
}

export interface EventBus {
  publish(event: JsonObject): Promise<void>;
}

export interface Dependencies {
  orders: OrderRepository;
  catalog: Catalog;
  payments: PaymentGateway;
  events: EventBus;
  now: () => string;
  newId: () => string;
}
