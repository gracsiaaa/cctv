import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from "path"

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Allow access via network (kamera HP)
    port: 5173,
  },
  resolve: {
    alias: {
      "@": path.resolve("./src"),
    },
  },
})
