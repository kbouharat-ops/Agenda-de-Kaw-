'use strict';
// Servidor de la Agenda de Kaw: lee y escribe tareas y notas en Neon (Postgres).
// Rutas:  GET    /api/data?c=tasks|notes
//         (c=game guarda la partida del juego)
//         PUT    /api/data?c=tasks|notes&id=ID   (crea o actualiza)
//         DELETE /api/data?c=tasks|notes&id=ID
const { neon } = require('@neondatabase/serverless');

const CATS = ['deberes', 'examen', 'trabajo', 'festivo', 'personal'];
const ID_RE = /^[A-Za-z0-9_-]{1,60}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

const SQL = {
  listTasks:
    'SELECT id, title, description AS "desc", category AS cat, ' +
    "to_char(date, 'YYYY-MM-DD') AS date, " +
    "COALESCE(to_char(end_date, 'YYYY-MM-DD'), '') AS \"end\", " +
    'time, done, important, ' +
    '(extract(epoch FROM updated_at) * 1000)::float8 AS "updatedAt" ' +
    'FROM tasks ORDER BY date, time, title',
  upsertTask:
    'INSERT INTO tasks (id, title, description, category, date, end_date, time, done, important) ' +
    "VALUES ($1, $2, $3, $4, $5::date, NULLIF($6, '')::date, $7, $8, $9) " +
    'ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description, ' +
    'category = EXCLUDED.category, date = EXCLUDED.date, end_date = EXCLUDED.end_date, ' +
    'time = EXCLUDED.time, done = EXCLUDED.done, important = EXCLUDED.important, updated_at = now()',
  deleteTask: 'DELETE FROM tasks WHERE id = $1',
  listNotes:
    'SELECT id, title, body, pinned, ' +
    '(extract(epoch FROM created_at) * 1000)::float8 AS "createdAt", ' +
    '(extract(epoch FROM updated_at) * 1000)::float8 AS "updatedAt" ' +
    'FROM notes ORDER BY pinned DESC, updated_at DESC',
  upsertNote:
    'INSERT INTO notes (id, title, body, pinned) VALUES ($1, $2, $3, $4) ' +
    'ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body, ' +
    'pinned = EXCLUDED.pinned, updated_at = now()',
  deleteNote: 'DELETE FROM notes WHERE id = $1',
  listGame: 'SELECT id, data FROM game_saves ORDER BY id',
  upsertGame:
    'INSERT INTO game_saves (id, data) VALUES ($1, $2::jsonb) ' +
    'ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()',
  deleteGame: 'DELETE FROM game_saves WHERE id = $1',
};

function validDate(s) {
  return typeof s === 'string' && DATE_RE.test(s) && !Number.isNaN(Date.parse(s + 'T00:00:00Z'));
}

function cleanTask(b) {
  const title = String(b.title == null ? '' : b.title).trim().slice(0, 80);
  if (!title) return null;
  const cat = CATS.includes(b.cat) ? b.cat : null;
  if (!cat || !validDate(b.date)) return null;
  const end = validDate(b.end) && b.end > b.date ? b.end : '';
  const time = typeof b.time === 'string' && TIME_RE.test(b.time) ? b.time : '';
  return {
    title,
    desc: String(b.desc == null ? '' : b.desc).slice(0, 500),
    cat,
    date: b.date,
    end,
    time,
    done: cat === 'festivo' ? false : !!b.done,
    important: !!b.important,
  };
}

function cleanNote(b) {
  return {
    title: String(b.title == null ? '' : b.title).slice(0, 100),
    body: String(b.body == null ? '' : b.body).slice(0, 20000),
    pinned: !!b.pinned,
  };
}

let client = null;
function getClient() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) return null;
  if (!client) client = neon(url);
  return client;
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  const send = (code, obj) => {
    res.statusCode = code;
    res.end(JSON.stringify(obj));
  };

  const q = req.query || {};
  const c = q.c;
  if (c !== 'tasks' && c !== 'notes' && c !== 'game') return send(400, { error: 'Colección no válida' });

  const sql = getClient();
  if (!sql) return send(503, { error: 'Falta la variable DATABASE_URL en Vercel' });

  try {
    if (req.method === 'GET') {
      const items = await sql.query(c === 'tasks' ? SQL.listTasks : c === 'notes' ? SQL.listNotes : SQL.listGame);
      return send(200, { items });
    }

    const id = String(q.id || '');
    if (!ID_RE.test(id)) return send(400, { error: 'Identificador no válido' });

    if (req.method === 'PUT') {
      let b = req.body;
      if (typeof b === 'string') {
        try { b = JSON.parse(b); } catch (e) { b = null; }
      }
      if (!b || typeof b !== 'object') return send(400, { error: 'Cuerpo no válido' });
      if (c === 'game') {
        const json = JSON.stringify(b);
        if (json.length > 60000) return send(400, { error: 'Partida demasiado grande' });
        await sql.query(SQL.upsertGame, [id, json]);
      } else if (c === 'tasks') {
        const t = cleanTask(b);
        if (!t) return send(400, { error: 'Tarea no válida' });
        await sql.query(SQL.upsertTask, [id, t.title, t.desc, t.cat, t.date, t.end, t.time, t.done, t.important]);
      } else {
        const n = cleanNote(b);
        await sql.query(SQL.upsertNote, [id, n.title, n.body, n.pinned]);
      }
      return send(200, { ok: true });
    }

    if (req.method === 'DELETE') {
      await sql.query(c === 'tasks' ? SQL.deleteTask : c === 'notes' ? SQL.deleteNote : SQL.deleteGame, [id]);
      return send(200, { ok: true });
    }

    res.setHeader('Allow', 'GET, PUT, DELETE');
    return send(405, { error: 'Método no permitido' });
  } catch (e) {
    console.error('agenda api error:', e && e.message);
    return send(500, { error: 'Error de base de datos' });
  }
};

module.exports.SQL = SQL;
module.exports.cleanTask = cleanTask;
module.exports.cleanNote = cleanNote;
