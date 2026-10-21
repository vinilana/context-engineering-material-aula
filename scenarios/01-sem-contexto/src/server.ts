import { createApplication } from "./app.js";

const port = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error("Invalid PORT");
const { server } = createApplication();
server.listen(port, "127.0.0.1", () => {
  const address = server.address();
  console.log(`Pronto Delivery: http://127.0.0.1:${typeof address === "object" && address ? address.port : port}`);
});
