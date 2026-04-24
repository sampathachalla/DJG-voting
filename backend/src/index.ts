import { backendConfig } from "./config.js";
import { createApp } from "./app.js";

const app = createApp();

app.listen(backendConfig.port, () => {
  console.log(`DoJaGa backend listening on http://localhost:${backendConfig.port}`);
});
