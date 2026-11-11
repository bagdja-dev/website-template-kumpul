import { watch, readFile, readdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const fixturesDirectory = resolve(root, 'fixtures');
const sourcePath = resolve(root, 'src/server.cjs');
const requireFromTemplate = createRequire(pathToFileURL(resolve(root, 'package.json')));
const React = requireFromTemplate('react');
const { renderToStaticMarkup } = requireFromTemplate('react-dom/server');
const manifest = JSON.parse(await readFile(resolve(root, 'manifest.json'), 'utf8'));
const templateName = manifest.slug
  .split('-')
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
  .join(' ');
const port = Number(process.env.PORT || 4173);
const clients = new Set();
let refreshTimer;

class FixtureError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  throw new Error(`PORT must be an integer between 1024 and 65535; received "${process.env.PORT}".`);
}

async function fixtureNames() {
  const files = await readdir(fixturesDirectory);
  return files
    .filter((file) => /^[a-z0-9][a-z0-9-]*\.json$/.test(file))
    .map((file) => file.slice(0, -5))
    .sort((left, right) => left === 'home' ? -1 : right === 'home' ? 1 : left.localeCompare(right));
}

async function loadFixture(name) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) {
    throw new FixtureError('Fixture name must contain only lowercase letters, numbers, and hyphens.', 400);
  }
  const available = await fixtureNames();
  if (!available.includes(name)) {
    throw new FixtureError(`Unknown fixture "${name}". Available fixtures: ${available.join(', ') || '(none)'}.`, 404);
  }
  return JSON.parse(await readFile(resolve(fixturesDirectory, `${name}.json`), 'utf8'));
}

function send(response, status, contentType, body) {
  response.writeHead(status, {
    'content-type': `${contentType}; charset=utf-8`,
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  response.end(body);
}

async function renderFixture(name) {
  const props = await loadFixture(name);
  const modulePath = requireFromTemplate.resolve(sourcePath);
  delete requireFromTemplate.cache[modulePath];
  const { render } = requireFromTemplate(modulePath);
  if (typeof render !== 'function') {
    throw new TypeError('src/server.cjs must export a render(props) function.');
  }
  const markup = renderToStaticMarkup(render(props));
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${templateName} local preview — ${name}</title><style>body{margin:0;min-height:100vh;background:#f0f7f8;color:#0f172a;font-family:Inter,ui-sans-serif,system-ui,sans-serif}*{box-sizing:border-box}</style></head><body>${markup}<script src="/client.js"></script></body></html>`;
}

function previewPage(fixtures) {
  const options = fixtures.map((name) => `<option value="${name}">${name}</option>`).join('');
  return `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${templateName} template preview</title>
  <style>
    *{box-sizing:border-box}body{margin:0;background:#e8eef2;color:#182230;font:14px/1.45 Inter,ui-sans-serif,system-ui,sans-serif}
    header{position:sticky;top:0;z-index:1;display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:12px 18px;background:#fff;border-bottom:1px solid #d5dee5}
    strong{margin-right:auto}label,button,select{font:inherit}select,button{padding:7px 10px;border:1px solid #cbd5df;border-radius:8px;background:#fff;color:inherit}
    button{cursor:pointer}button[aria-pressed=true]{border-color:#006699;color:#006699;background:#e6f4f6}
    main{display:flex;justify-content:center;padding:20px;overflow:auto}iframe{height:calc(100vh - 110px);min-height:500px;border:1px solid #cad4dd;border-radius:10px;background:#fff;box-shadow:0 6px 24px #17203312}
  </style>
</head>
<body>
  <header>
    <strong>${templateName} — local SSR preview</strong>
    <label for="fixture">Fixture</label>
    <select id="fixture">${options}</select>
    <button type="button" data-width="1280" aria-pressed="true">Desktop</button>
    <button type="button" data-width="390" aria-pressed="false">Mobile</button>
  </header>
  <main><iframe id="preview" title="Template preview" sandbox="allow-scripts"></iframe></main>
  <script>
    const frame=document.querySelector('#preview'),fixture=document.querySelector('#fixture'),buttons=[...document.querySelectorAll('[data-width]')];
    function refresh(){frame.src='/render?fixture='+encodeURIComponent(fixture.value)+'&t='+Date.now()}
    function resize(width){frame.style.width=width+'px';buttons.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.width===String(width))))}
    fixture.addEventListener('change',refresh);buttons.forEach(button=>button.addEventListener('click',()=>resize(button.dataset.width)));
    resize(1280);refresh();const events=new EventSource('/events');events.addEventListener('change',refresh);
  </script>
</body>
</html>`;
}

const server = createServer(async (request, response) => {
  if (request.method !== 'GET') {
    send(response, 405, 'text/plain', 'Only GET is supported.');
    return;
  }
  const url = new URL(request.url, 'http://127.0.0.1');
  try {
    if (url.pathname === '/') {
      send(response, 200, 'text/html', previewPage(await fixtureNames()));
    } else if (url.pathname === '/render') {
      send(response, 200, 'text/html', await renderFixture(url.searchParams.get('fixture') || 'home'));
    } else if (url.pathname === '/client.js') {
      send(response, 200, 'text/javascript', await readFile(resolve(root, 'src/client.js'), 'utf8'));
    } else if (url.pathname === '/events') {
      response.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
      });
      response.write('event: ready\ndata: ok\n\n');
      clients.add(response);
      response.on('close', () => clients.delete(response));
    } else {
      send(response, 404, 'text/plain', 'Not found.');
    }
  } catch (error) {
    console.error(`[preview] ${error.stack || error.message}`);
    send(response, error instanceof FixtureError ? error.statusCode : 500, 'text/plain', `Preview failed: ${error.message}`);
  }
});

for (const directory of [resolve(root, 'src'), fixturesDirectory]) {
  const watcher = watch(directory, { persistent: true });
  (async () => {
    for await (const event of watcher) {
      if (event.filename?.toString().startsWith('.')) continue;
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        for (const client of clients) client.write('event: change\ndata: updated\n\n');
      }, 120);
    }
  })().catch((error) => {
    console.error(`[preview] Could not watch ${directory}: ${error.message}`);
  });
}

server.listen(port, '127.0.0.1', () => {
  console.log(`${templateName} local preview: http://127.0.0.1:${port}`);
  console.log('Edit files in src/ or fixtures/ to refresh the preview.');
  console.log('The local catalog filter runs only on fixture props; no platform APIs or actions are available.');
});
