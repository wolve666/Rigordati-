// Adattatore per Node.js con il SQLite integrato (node:sqlite): per i test e per il server tuo.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';

export function apriDb(percorso = ':memory:') {
  const db = new DatabaseSync(percorso);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  db.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
  const piatto = r => r && { ...r };
  return {
    tutti: async (sql, ...v) => db.prepare(sql).all(...v).map(piatto),
    uno: async (sql, ...v) => piatto(db.prepare(sql).get(...v)),
    esegui: async (sql, ...v) => { db.prepare(sql).run(...v); }
  };
}
