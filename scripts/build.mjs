import { copyFile, mkdir } from 'node:fs/promises';

await mkdir('dist', { recursive: true });
await copyFile('src/server.cjs', 'dist/server.cjs');
await copyFile('src/client.js', 'dist/client.js');
console.log('Built dist/server.cjs and dist/client.js');
