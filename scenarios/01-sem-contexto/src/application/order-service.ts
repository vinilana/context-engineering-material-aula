import type { Order, OrderStatus } from "../domain/order.js";
import { transitionOrder } from "../domain/order.js";
import { DomainError } from "../domain/errors.js";
import type { Dependencies } from "./ports.js";

export interface PlaceOrderInput {
  customerId: string;
  restaurantId: string;
  paymentId: string;
  deliveryAddress: string;
  items: { productId: string; quantity: number }[];
}

export class OrderService {
  constructor(private readonly dependencies: Dependencies) {}

  place(input: PlaceOrderInput): Order {
    const restaurant = this.dependencies.catalog.findRestaurant(input.restaurantId);
    if (!restaurant) throw new DomainError("RESTAURANT_NOT_FOUND", "Restaurant not found", 404);
    if (!restaurant.isOpen) throw new DomainError("RESTAURANT_CLOSED", "Restaurant is closed", 409);
    if (input.items.length === 0) throw new DomainError("EMPTY_ORDER", "Order must contain items", 422);

    const items = input.items.map((item) => {
      const product = this.dependencies.catalog.findProduct(item.productId);
      if (!product || product.restaurantId !== restaurant.id || !product.available) {
        throw new DomainError("PRODUCT_UNAVAILABLE", "Product is unavailable at this restaurant", 422);
      }
      if (!Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 20) {
        throw new DomainError("INVALID_QUANTITY", "Quantity must be between 1 and 20", 422);
      }
      return { productId: product.id, name: product.name, unitPriceCents: product.priceCents, quantity: item.quantity };
    });
    const subtotalCents = items.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0);
    const now = this.dependencies.now();
    const order: Order = {
      id: this.dependencies.newId(),
      customerId: input.customerId,
      restaurantId: restaurant.id,
      paymentId: input.paymentId,
      deliveryAddress: input.deliveryAddress,
      items,
      subtotalCents,
      deliveryFeeCents: restaurant.deliveryFeeCents,
      totalCents: subtotalCents + restaurant.deliveryFeeCents,
      status: "placed",
      createdAt: now,
      updatedAt: now,
    };
    this.dependencies.orders.save(order);
    return order;
  }

  get(id: string): Order {
    const order = this.dependencies.orders.findById(id);
    if (!order) throw new DomainError("ORDER_NOT_FOUND", "Order not found", 404);
    return order;
  }

  list(): Order[] {
    return this.dependencies.orders.list();
  }

  changeStatus(id: string, status: OrderStatus): Order {
    const updated = transitionOrder(this.get(id), status, this.dependencies.now());
    this.dependencies.orders.save(updated);
    return updated;
  }
}
