// Local malware-scanner stand-in for end-to-end tests. It speaks the production scanner protocol (POST the file bytes
// with a bearer token, get {"clean": boolean}) and flags the standard EICAR antivirus test string. It is not a scanner:
// it proves the app's scanning path and its failure handling. Bound to 127.0.0.1 only.
import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';

const port = Number(process.env.LOCAL_SCANNER_PORT ?? 8790);
const token = process.env.FILE_SCAN_TOKEN ?? '';
if (!/^[A-Za-z0-9_-]{16,}$/.test(token)) {
  console.error('FILE_SCAN_TOKEN must be set (16+ URL-safe characters).');
  process.exit(1);
}
const EICAR = 'EICAR-STANDARD-ANTIVIRUS-TEST-FILE';
const expected = Buffer.from('Bearer ' + token);

function authorized(header) {
  const given = Buffer.from(header ?? '');
  return given.length === expected.length && timingSafeEqual(given, expected);
}

let scans = 0;

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/stats') {
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ scans }));
    return;
  }
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' }).end('{"ok":true}');
    return;
  }
  if (req.method !== 'POST' || req.url !== '/scan') {
    res.writeHead(404).end();
    return;
  }
  if (!authorized(req.headers.authorization)) {
    res.writeHead(401, { 'Content-Type': 'application/json' }).end('{"error":"unauthorized"}');
    return;
  }
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    scans += 1;
    const clean = !Buffer.concat(chunks).toString('latin1').includes(EICAR);
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ clean }));
  });
});
server.listen(port, '127.0.0.1', () => console.log(`local scanner listening on 127.0.0.1:${port}`));
