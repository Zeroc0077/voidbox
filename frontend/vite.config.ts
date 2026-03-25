import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
  plugins: [solidPlugin(), viteSingleFile()],
  server: {
    proxy: {
      "/api": "http://localhost:8787",
      "/llms.txt": "http://localhost:8787",
    },
  },
  build: {
    target: "esnext",
  },
});
