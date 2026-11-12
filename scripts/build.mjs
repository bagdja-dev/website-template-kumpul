import { mkdir } from 'node:fs/promises';
import { build } from 'esbuild';

await mkdir('dist', { recursive: true });
await build({
  entryPoints: ['src/server.cjs'],
  outfile: 'dist/server.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['react'],
});
await build({
  entryPoints: ['src/client.js'],
  outfile: 'dist/client.js',
  bundle: true,
  platform: 'browser',
  format: 'iife',
});
console.log('Built dist/server.cjs and dist/client.js');
