import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

// Dev only: serve POST /api/route from the same handler Vercel runs, so `npm run dev` needs no Vercel CLI.
function devApi(env) {
  return {
    name: 'dev-api-route',
    configureServer(server) {
      server.middlewares.use('/api/route', async (req, res) => {
        const chunks = [];
        for await (const c of req) chunks.push(c);
        let body = null;
        try { body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : null; } catch { body = null; }
        const { handleRoute } = await server.ssrLoadModule('/src/server/handleRoute.js');
        const out = await handleRoute(
          { method: req.method, headers: req.headers, body, ip: req.socket.remoteAddress || 'local' },
          { ...process.env, ...env },
        );
        res.statusCode = out.status;
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify(out.json));
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), ''); // all vars, server-side only; never exposed to the client bundle
  return {
    plugins: [react(), devApi(env)],
    build: {
      outDir: 'dist',
      rollupOptions: {
        input: { main: resolve('index.html'), handoff: resolve('handoff.html') },
        output: { manualChunks: (id) => (id.includes('node_modules') ? 'vendor' : undefined) },
      },
    },
  };
});
