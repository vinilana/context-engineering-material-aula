import { OrderService } from "./application/order-service.js";
import { createDependencies } from "./infrastructure/memory.js";
import { createHttpServer } from "./http/server.js";
import type { Dependencies } from "./application/ports.js";

export function createApplication(dependencies: Dependencies = createDependencies()) {
  const service = new OrderService(dependencies);
  return { server: createHttpServer(service), service, dependencies };
}
