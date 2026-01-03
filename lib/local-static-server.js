const http = require('http');
const fs = require('fs');
const path = require('path');

function withCommonHeaders(res) {
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
}

function safeResolveFilePath(staticRoot, urlPathname) {
  const decoded = decodeURIComponent(urlPathname);
  const withoutQuery = decoded.split('?')[0].split('#')[0];
  const trimmed = withoutQuery.replace(/^\/+/, '');
  const normalized = path.normalize(trimmed);
  const joined = path.join(staticRoot, normalized);
  const resolved = path.resolve(joined);

  if (!resolved.startsWith(staticRoot + path.sep) && resolved !== staticRoot) {
    return null;
  }
  return resolved;
}

function contentTypeForExt(ext) {
  switch (ext) {
    case '.html':
      return 'text/html; charset=utf-8';
    case '.js':
      return 'application/javascript; charset=utf-8';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.wasm':
      return 'application/wasm';
    case '.svg':
      return 'image/svg+xml';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.webp':
      return 'image/webp';
    case '.avif':
      return 'image/avif';
    case '.ico':
      return 'image/x-icon';
    case '.woff2':
      return 'font/woff2';
    case '.map':
      return 'application/json; charset=utf-8';
    case '.txt':
      return 'text/plain; charset=utf-8';
    default:
      return 'application/octet-stream';
  }
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = contentTypeForExt(ext);

  withCommonHeaders(res);
  res.statusCode = 200;
  res.setHeader('Content-Type', contentType);

  const stream = fs.createReadStream(filePath);
  stream.on('error', () => {
    res.statusCode = 500;
    res.end('Internal Server Error');
  });
  stream.pipe(res);
}

function sendNotFound(staticRoot, req, res) {
  const accept = (req.headers.accept || '').toLowerCase();
  const wantsHtml = accept.includes('text/html') || accept.includes('*/*');
  const indexPath = path.join(staticRoot, 'index.html');

  if (wantsHtml && fs.existsSync(indexPath)) {
    sendFile(res, indexPath);
    return;
  }

  withCommonHeaders(res);
  res.statusCode = 404;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.end('Not Found');
}

function createStaticServer(staticRoot) {
  return http.createServer((req, res) => {
    if (!req.url) {
      withCommonHeaders(res);
      res.statusCode = 400;
      res.end('Bad Request');
      return;
    }

    const url = new URL(req.url, 'http://127.0.0.1');
    if (url.pathname === '/editor') {
      withCommonHeaders(res);
      res.statusCode = 302;
      res.setHeader('Location', '/');
      res.end();
      return;
    }

    const pathname = url.pathname.endsWith('/')
      ? url.pathname + 'index.html'
      : url.pathname;
    const filePath = safeResolveFilePath(
      staticRoot,
      pathname === '/' ? '/index.html' : pathname,
    );
    if (!filePath) {
      sendNotFound(staticRoot, req, res);
      return;
    }

    let stat;
    try {
      stat = fs.statSync(filePath);
    } catch {
      sendNotFound(staticRoot, req, res);
      return;
    }

    if (stat.isDirectory()) {
      const dirIndex = path.join(filePath, 'index.html');
      if (fs.existsSync(dirIndex)) {
        sendFile(res, dirIndex);
        return;
      }
      sendNotFound(staticRoot, req, res);
      return;
    }

    sendFile(res, filePath);
  });
}

async function startStaticServer(staticRoot) {
  if (!fs.existsSync(staticRoot)) {
    throw new Error(`Missing static root at "${staticRoot}"`);
  }

  const server = createStaticServer(staticRoot);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  return {
    server,
    url: `http://127.0.0.1:${port}/`,
  };
}

module.exports = {
  startStaticServer,
};

