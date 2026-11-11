import { copyFile, mkdir } from 'node:fs/promises';
import { build } from 'esbuild';

await mkdir('dist', { recursive: true });
await copyFile('src/server.cjs', 'dist/server.cjs');
await build({
  entryPoints: ['src/client.js'],
  outfile: 'dist/client.js',
  bundle: true,
  platform: 'browser',
  format: 'iife',
});
console.log('Built dist/server.cjs and dist/client.js');
