import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./",
  server: {
    proxy: {
      "/village-api": {
        target: "https://theaidigest.org",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/village-api/, "/village"),
      },
    },
  },
});
