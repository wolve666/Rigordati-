// Server RicordaMi su Node: `node server/locale.mjs [porta] [file.db]`
// Per le prove sul computer e, domani, per il server tuo (dietro Caddy o nginx per l'HTTPS).
import { createServer } from 'node:http';
import { creaApp } from './app.js';
import { apriDb } from './sqlite-node.js';

const porta = +(process.argv[2] || process.env.PORT || 8787);
const app = creaApp(apriDb(process.argv[3] || process.env.DB || 'ricordami.db'));

createServer(async (req, res) => {
  const corpo = ['GET', 'HEAD', 'OPTIONS'].includes(req.method) ? undefined : await new Promise(ok => { const p = []; req.on('data', c => p.push(c)); req.on('end', () => ok(Buffer.concat(p))); });
  const r = await app(new Request(`http://${req.headers.host}${req.url}`, { method: req.method, headers: req.headers, body: corpo }));
  res.writeHead(r.status, Object.fromEntries(r.headers)).end(Buffer.from(await r.arrayBuffer()));
}).listen(porta, () => console.log(`RicordaMi server su http://localhost:${porta}`));
