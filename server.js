const express = require('express');
const fs = require('fs');
const path = require('path');
const { marked } = require('marked');
const cors = require('cors');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 3000;
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS || '*';

// ─── Database setup ────────────────────────────────────────────────────────────

const DB_PATH = path.join(__dirname, 'comments.db');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS threads (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    anchor_context TEXT NOT NULL,
    anchor_prefix TEXT NOT NULL DEFAULT '',
    anchor_suffix TEXT NOT NULL DEFAULT '',
    anchor_offset_guess INTEGER NOT NULL DEFAULT 0,
    resolved INTEGER NOT NULL DEFAULT 0,
    resolved_at TEXT,
    resolved_comment TEXT,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_threads_document ON threads(document_id);

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    author TEXT,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_id);
`);

// ─── Middleware ────────────────────────────────────────────────────────────────

const corsOptions = ALLOWED_ORIGINS === '*'
  ? { origin: '*' }
  : { origin: ALLOWED_ORIGINS.split(',').map(s => s.trim()) };

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getThreadsForDocument(documentId) {
  const threads = db.prepare(`
    SELECT id, document_id, anchor_context, anchor_prefix, anchor_suffix,
           anchor_offset_guess, resolved, resolved_at, resolved_comment, created_at
    FROM threads WHERE document_id = ? ORDER BY created_at ASC
  `).all(documentId);

  return threads.map(t => {
    const messages = db.prepare(`
      SELECT id, text, author, created_at FROM messages
      WHERE thread_id = ? ORDER BY created_at ASC
    `).all(t.id);

    return {
      id: t.id,
      documentId: t.document_id,
      anchor: {
        context: t.anchor_context,
        prefix: t.anchor_prefix,
        suffix: t.anchor_suffix,
        offset_guess: t.anchor_offset_guess,
      },
      messages,
      resolved: t.resolved === 1,
      resolvedAt: t.resolved_at,
      resolvedComment: t.resolved_comment,
      createdAt: t.created_at,
    };
  });
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /api/document?documentId=xxx
// For local dev: returns rendered HTML + raw markdown for the sample file.
// In production static-site mode, clients fetch threads separately and
// already have the markdown embedded in the page — this endpoint isn't needed.
app.get('/api/document', (req, res) => {
  const documentId = req.query.documentId || 'local';
  const mdPath = path.join(__dirname, 'sample.md');

  try {
    const markdown = fs.readFileSync(mdPath, 'utf8');
    const html = marked.parse(markdown);
    const threads = getThreadsForDocument(documentId);
    res.json({ html, markdown, threads });
  } catch (err) {
    console.error('GET /api/document error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/threads?documentId=xxx
// Pure thread fetch — used by static sites. Returns raw threads, no re-anchoring.
// The client does re-anchoring against its local markdown.
app.get('/api/threads', (req, res) => {
  const { documentId } = req.query;
  if (!documentId) return res.status(400).json({ error: 'documentId is required' });

  try {
    res.json({ threads: getThreadsForDocument(documentId) });
  } catch (err) {
    console.error('GET /api/threads error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/comment — creates a new thread
// Body: { documentId, text, author, selectedText, offset, prefix, suffix }
app.post('/api/comment', (req, res) => {
  const { documentId, text, author, selectedText, offset, prefix, suffix } = req.body;

  if (!documentId || !text || !selectedText || offset == null) {
    return res.status(400).json({ error: 'documentId, text, selectedText, and offset are required' });
  }

  const now = new Date().toISOString();
  const threadId = `thread_${Date.now()}`;
  const messageId = `${threadId}_m0`;

  // If prefix/suffix weren't computed client-side, they'll be empty strings
  const anchorPrefix = prefix || '';
  const anchorSuffix = suffix || '';

  db.prepare(`
    INSERT INTO threads (id, document_id, anchor_context, anchor_prefix, anchor_suffix,
                         anchor_offset_guess, resolved, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 0, ?)
  `).run(threadId, documentId, selectedText, anchorPrefix, anchorSuffix, offset, now);

  db.prepare(`
    INSERT INTO messages (id, thread_id, text, author, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(messageId, threadId, text, author || null, now);

  const thread = getThreadsForDocument(documentId).find(t => t.id === threadId);
  res.json({ success: true, thread });
});

// POST /api/thread/:id/reply
// Body: { text, author }
app.post('/api/thread/:id/reply', (req, res) => {
  const { id } = req.params;
  const { text, author } = req.body;
  if (!text) return res.status(400).json({ error: 'text is required' });

  const thread = db.prepare('SELECT id FROM threads WHERE id = ?').get(id);
  if (!thread) return res.status(404).json({ error: 'Thread not found' });

  const msgCount = db.prepare('SELECT COUNT(*) as n FROM messages WHERE thread_id = ?').get(id).n;
  const messageId = `${id}_m${msgCount}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO messages (id, thread_id, text, author, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(messageId, id, text, author || null, now);

  const message = db.prepare('SELECT id, text, author, created_at FROM messages WHERE id = ?').get(messageId);
  res.json({ success: true, message });
});

// POST /api/thread/:id/resolve
// Body: { comment? }
app.post('/api/thread/:id/resolve', (req, res) => {
  const { id } = req.params;
  const { comment } = req.body;

  const thread = db.prepare('SELECT id FROM threads WHERE id = ?').get(id);
  if (!thread) return res.status(404).json({ error: 'Thread not found' });

  db.prepare(`
    UPDATE threads SET resolved = 1, resolved_at = ?, resolved_comment = ? WHERE id = ?
  `).run(new Date().toISOString(), comment || null, id);

  res.json({ success: true });
});

// DELETE /api/thread/:id
app.delete('/api/thread/:id', (req, res) => {
  const { id } = req.params;

  const thread = db.prepare('SELECT id FROM threads WHERE id = ?').get(id);
  if (!thread) return res.status(404).json({ error: 'Thread not found' });

  db.prepare('DELETE FROM threads WHERE id = ?').run(id);
  res.json({ success: true });
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`CORS: ${ALLOWED_ORIGINS}`);
  console.log(`DB: ${DB_PATH}`);
});
