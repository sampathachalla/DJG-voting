import { backendConfig } from "./config.js";
import { createApp } from "./app.js";

const app = createApp();

app.listen(backendConfig.port, "0.0.0.0", () => {
  console.log(`DoJaGa backend listening on http://127.0.0.1:${backendConfig.port}`);
});
