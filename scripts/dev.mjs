import { context } from 'esbuild';
import { buildOptions, handleShutdown, prepareOutput, watchStaticFiles } from './build.mjs';

await prepareOutput();
const buildContext = await context(buildOptions(true, true));
await buildContext.rebuild();
await buildContext.watch();
const server = await buildContext.serve({
  servedir: '.',
  host: '127.0.0.1',
  ...(process.env.PORT ? { port: Number(process.env.PORT) } : {}),
});
handleShutdown(buildContext, watchStaticFiles(buildContext));
console.log(`[plan-your-net] Development: http://127.0.0.1:${server.port}`);
