import { DomainError } from "./errors.js";

export type OrderStatus = "placed" | "confirmed" | "preparing" | "dispatched" | "delivered";

export interface OrderItem {
  productId: string;
  name: string;
  unitPriceCents: number;
  quantity: number;
}

export interface Order {
  id: string;
  customerId: string;
  restaurantId: string;
  paymentId: string;
  items: OrderItem[];
  deliveryAddress: string;
  subtotalCents: number;
  deliveryFeeCents: number;
  totalCents: number;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
}

const transitions: Record<OrderStatus, readonly OrderStatus[]> = {
  placed: ["confirmed"],
  confirmed: ["preparing"],
  preparing: ["dispatched"],
  dispatched: ["delivered"],
  delivered: [],
};

export function transitionOrder(order: Order, status: OrderStatus, now: string): Order {
  if (!transitions[order.status].includes(status)) {
    throw new DomainError("INVALID_STATUS_TRANSITION", "Order cannot move to the requested status", 409);
  }
  return { ...order, status, updatedAt: now };
}
