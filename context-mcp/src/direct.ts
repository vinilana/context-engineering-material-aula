import "./env.js";
import { engine } from "./engine.js";

const task = process.argv.slice(2).join(" ") || "cancelar pedido com estorno e evento de logística";
const result = await engine.invoke("context.prepare_task", { task }, { source: "direct", principal: null });
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
