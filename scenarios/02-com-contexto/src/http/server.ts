import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { z } from "zod";
import type { OrderService } from "../application/order-service.js";
import { DomainError } from "../domain/errors.js";

const placeSchema = z.object({
  customerId: z.string().trim().min(1).max(100),
  restaurantId: z.string().trim().min(1).max(100),
  paymentId: z.string().trim().min(1).max(100),
  deliveryAddress: z.string().trim().min(5).max(500),
  items: z.array(z.object({
    productId: z.string().trim().min(1).max(100),
    quantity: z.number().int().min(1).max(20),
  }).strict()).min(1).max(50),
}).strict();

const statusSchema = z.object({
  status: z.enum(["placed", "confirmed", "preparing", "dispatched", "delivered"]),
}).strict();

function send(response: ServerResponse, status: number, data: unknown): void {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(data));
}

async function readBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 64 * 1024) throw new DomainError("PAYLOAD_TOO_LARGE", "Request body is too large", 413);
    chunks.push(Buffer.from(chunk));
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new DomainError("INVALID_JSON", "Request body must be valid JSON", 400);
  }
}

export function createHttpServer(service: OrderService) {
  return createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
      if (request.method === "GET" && pathname === "/health") return send(response, 200, { status: "ok" });
      if (request.method === "GET" && pathname === "/orders") return send(response, 200, { orders: service.list() });
      if (request.method === "POST" && pathname === "/orders") {
        return send(response, 201, service.place(placeSchema.parse(await readBody(request))));
      }
      const match = /^\/orders\/([^/]+)(?:\/(status))?$/.exec(pathname);
      if (match?.[1]) {
        if (request.method === "GET" && !match[2]) return send(response, 200, service.get(match[1]));
        if (request.method === "POST" && match[2] === "status") {
          const input = statusSchema.parse(await readBody(request));
          return send(response, 200, service.changeStatus(match[1], input.status));
        }
      }
      send(response, 404, { error: { code: "ROUTE_NOT_FOUND", message: "Route not found" } });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return send(response, 422, { error: { code: "VALIDATION_ERROR", message: "Invalid request", issues: error.issues } });
      }
      if (error instanceof DomainError) {
        return send(response, error.statusCode, { error: { code: error.code, message: error.message } });
      }
      send(response, 500, { error: { code: "INTERNAL_ERROR", message: "Unexpected error" } });
    }
  });
}
