import { defineConfig } from 'vite';

/** Der Entwicklungsserver übernimmt einen von außen gesetzten Port. */
export default defineConfig({
  server: {
    port: Number(process.env.PORT) || 5173,
    strictPort: false,
  },
});
