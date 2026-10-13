import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { normalizeBasePath } from "./app.meta";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    base: normalizeBasePath(env.VITE_BASE_PATH || "/"),
    plugins: [react()],
  };
});
