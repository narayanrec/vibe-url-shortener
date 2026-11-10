const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { createStorage } = require('./storage');
const { generateSlug } = require('./slug');

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const CODE_PATTERN = /^[a-zA-Z0-9]{8}$/;
const storage = createStorage();

function sendJson(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(body));
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 10_000) {
        reject(Object.assign(new Error('Request body is too large.'), { status: 413 }));
        request.destroy();
      }
    });
    request.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch { reject(Object.assign(new Error('Please send a valid URL.'), { status: 400 })); }
    });
    request.on('error', reject);
  });
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);

  if (url.pathname === '/api/shorten' && request.method === 'POST') {
    try {
      const body = await readJson(request);
      if (typeof body.url !== 'string' || !body.url.trim()) {
        return sendJson(response, 400, { error: 'Enter a URL to get started.' });
      }
      let destination;
      try { destination = new URL(body.url.trim()); }
      catch { return sendJson(response, 400, { error: 'That URL doesn’t look quite right. Check it and try again.' }); }
      if (!['http:', 'https:'].includes(destination.protocol)) {
        return sendJson(response, 400, { error: 'Please use a URL that starts with http:// or https://.' });
      }

      const normalizedUrl = destination.toString();
      let entry;
      try {
        entry = await storage.createOrGet(normalizedUrl, generateSlug);
      } catch (error) {
        console.error('Could not save short link:', error.message);
        return sendJson(response, 500, { error: 'The link couldn’t be saved. Please try again.' });
      }
      const shortUrl = `${url.origin}/${entry.code}`;
      return sendJson(response, entry.created ? 201 : 200, { shortUrl, originalUrl: normalizedUrl, expiresAt: entry.expiresAt });
    } catch (error) {
      return sendJson(response, error.status || 400, { error: error.message || 'Something went wrong.' });
    }
  }

  if (url.pathname === '/api/links' && request.method === 'GET') {
    const storedLinks = await storage.list();
    const items = storedLinks.map(({ code, url: originalUrl, expiresAt }) => ({ shortUrl: `${url.origin}/${code}`, originalUrl, expiresAt }));
    return sendJson(response, 200, { links: items });
  }

  if (request.method === 'GET' && CODE_PATTERN.test(url.pathname.slice(1))) {
    const destination = await storage.findByCode(url.pathname.slice(1));
    if (destination) {
      response.writeHead(302, { Location: destination.url, 'Cache-Control': 'no-store' });
      return response.end();
    }
    response.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    return response.end('<!doctype html><title>Link not found</title><h1>This short link doesn’t exist.</h1><p><a href="/">Make a new one</a></p>');
  }

  if (request.method === 'GET' && ['/', '/index.html', '/links.html'].includes(url.pathname)) {
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
    const page = url.pathname === '/links.html' ? 'links.html' : 'index.html';
    return fs.createReadStream(path.join(PUBLIC_DIR, page)).pipe(response);
  }

  response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  response.end('Not found');
});

server.listen(PORT, () => console.log(`URL shortener is running at http://localhost:${PORT}`));
