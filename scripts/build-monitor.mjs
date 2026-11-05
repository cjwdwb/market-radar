import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export async function buildMonitor(outDir = resolve(root, 'outputs')) {
  // This independent Worker must not load the website's plugins, bindings or env files.
  await build({
    root, configFile: false, envFile: false, publicDir: false, logLevel: 'warn',
    build: {
      outDir, emptyOutDir: false, copyPublicDir: false, sourcemap: false, minify: false,
      target: 'es2022',
      lib: { entry: resolve(root, 'monitor/worker.mjs'), formats: ['es'], fileName: () => 'monitor.mjs' },
    },
  });
  return resolve(outDir, 'monitor.mjs');
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) await buildMonitor();
