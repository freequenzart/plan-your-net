import { context } from 'esbuild';
import { access } from 'node:fs/promises';
import { handleShutdown } from './build.mjs';

try {
  await access('dist/index.html');
} catch {
  console.error('No build found. Run npm run build first.');
  process.exit(1);
}

const buildContext = await context({});
const server = await buildContext.serve({
  servedir: 'dist',
  host: '127.0.0.1',
  ...(process.env.PORT ? { port: Number(process.env.PORT) } : {}),
});
handleShutdown(buildContext);
console.log(`[plan-your-net] Preview: http://127.0.0.1:${server.port}`);
