// Server RicordaMi su Cloudflare Workers, con il database D1 (variabile DB in wrangler.toml).
import { creaApp } from './app.js';

const d1 = DB => ({
  tutti: async (sql, ...v) => (await DB.prepare(sql).bind(...v).all()).results,
  uno: async (sql, ...v) => (await DB.prepare(sql).bind(...v).first()) ?? undefined,
  esegui: async (sql, ...v) => { await DB.prepare(sql).bind(...v).run(); }
});

let app = null;
export default {
  fetch(req, env) {
    app ||= creaApp(d1(env.DB));
    return app(req);
  }
};
