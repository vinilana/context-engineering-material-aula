import { createHash, timingSafeEqual } from "node:crypto";
import type { McpHttpAuthOptions } from "@invokta/mcp";
import { EngineStartupError } from "./env.js";

export function createHttpAuth(config: { mode: string; host: string; token?: string | undefined }): McpHttpAuthOptions {
  if (config.mode === "development") {
    if (!["127.0.0.1", "localhost", "::1", "[::1]"].includes(config.host)) {
      throw new EngineStartupError("Development HTTP authentication is restricted to loopback hosts.");
    }
    return { mode: "dangerously-disabled-for-development" };
  }
  if (config.mode !== "required") throw new EngineStartupError("INVOKTA_HTTP_AUTH_MODE must be required or development.");
  if (!config.token?.trim()) throw new EngineStartupError("CONTEXT_MCP_TOKEN is required for authenticated HTTP.");
  const expected = createHash("sha256").update(`Bearer ${config.token}`).digest();
  return {
    mode: "required",
    authenticate(request) {
      const value = request.headers.get("authorization");
      if (value === null) return null;
      const actual = createHash("sha256").update(value).digest();
      return timingSafeEqual(actual, expected) ? { id: "client:context-reader" } : null;
    },
  };
}
