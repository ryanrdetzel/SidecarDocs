const express = require('express');
const fs = require('fs');
const path = require('path');
const { marked } = require('marked');
const cors = require('cors');
const { parseFrontmatter, makeDocumentId, findMarkdownFiles } = require('./lib/document-id');
const store = require('./lib/sidecar-store');

const app = express();
const PORT = process.env.PORT || 3000;
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS || '*';
const DOCS_DIR = process.env.DOCS_DIR || null;
const SITE_ID = process.env.SITE_ID || 'local-dev';

// ─── Document mapping ────────────────────────────────────────────────────────
// Maps documentId → markdown file path so we know where to read/write sidecars.

const docMap = new Map();       // documentId → mdFilePath
const threadIndex = new Map();  // threadId → documentId (populated on read)

function buildDocMap() {
  docMap.clear();
  if (DOCS_DIR) {
    const docsDir = path.resolve(DOCS_DIR);
    const files = findMarkdownFiles(docsDir);
    for (const filePath of files) {
      const raw = fs.readFileSync(filePath, 'utf8');
      const { data } = parseFrontmatter(raw);
      const docId = makeDocumentId(filePath, docsDir, SITE_ID, data.id || null);
      docMap.set(docId, filePath);
    }
    console.log(`Mapped ${docMap.size} document(s) from ${docsDir}`);
  } else {
    // Dev mode: single file
    const samplePath = path.join(__dirname, 'sample.md');
    docMap.set('local', samplePath);
    console.log(`Dev mode: sample.md → local`);
  }
}

function getMdPath(documentId) {
  return docMap.get(documentId) || null;
}

// Index thread IDs when threads are loaded so reply/resolve/delete can find the file
function indexThreads(documentId, threads) {
  for (const t of threads) {
    threadIndex.set(t.id, documentId);
  }
}

function getMdPathForThread(threadId) {
  const docId = threadIndex.get(threadId);
  return docId ? getMdPath(docId) : null;
}

// ─── Middleware ────────────────────────────────────────────────────────────────

const corsOptions = ALLOWED_ORIGINS === '*'
  ? { origin: '*' }
  : { origin: ALLOWED_ORIGINS.split(',').map(s => s.trim()) };

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /api/document?documentId=xxx
app.get('/api/document', (req, res) => {
  const documentId = req.query.documentId || 'local';
  const mdPath = getMdPath(documentId);

  if (!mdPath || !fs.existsSync(mdPath)) {
    return res.status(404).json({ error: 'Document not found' });
  }

  try {
    const raw = fs.readFileSync(mdPath, 'utf8');
    const { content } = parseFrontmatter(raw);
    const html = marked.parse(content);
    const threads = store.getThreads(mdPath);
    indexThreads(documentId, threads);
    res.json({ html, markdown: content, threads });
  } catch (err) {
    console.error('GET /api/document error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/threads?documentId=xxx
app.get('/api/threads', (req, res) => {
  const { documentId } = req.query;
  if (!documentId) return res.status(400).json({ error: 'documentId is required' });

  const mdPath = getMdPath(documentId);
  if (!mdPath) return res.status(404).json({ error: 'Document not found' });

  try {
    const threads = store.getThreads(mdPath);
    indexThreads(documentId, threads);
    res.json({ threads });
  } catch (err) {
    console.error('GET /api/threads error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/comment — creates a new thread
// Body: { documentId, text, author, elementType, elementIndex, elementText, selectedText }
app.post('/api/comment', (req, res) => {
  const { documentId, text, author, elementType, elementIndex, elementText, selectedText } = req.body;

  if (!documentId || !text || !elementType || elementIndex == null) {
    return res.status(400).json({ error: 'documentId, text, elementType, and elementIndex are required' });
  }

  const mdPath = getMdPath(documentId);
  if (!mdPath) return res.status(404).json({ error: 'Document not found' });

  const now = new Date().toISOString();
  const threadId = `thread_${Date.now()}`;
  const messageId = `${threadId}_m0`;

  const thread = {
    id: threadId,
    anchor: {
      elementType,
      elementIndex,
      elementText: elementText || '',
      selectedText: selectedText || null,
    },
    resolved: false,
    resolvedAt: null,
    resolvedComment: null,
    createdAt: now,
    messages: [
      { id: messageId, text, author: author || null, createdAt: now },
    ],
  };

  store.addThread(mdPath, thread);
  threadIndex.set(threadId, documentId);
  res.json({ success: true, thread });
});

// POST /api/thread/:id/reply
// Body: { text, author }
app.post('/api/thread/:id/reply', (req, res) => {
  const { id } = req.params;
  const { text, author } = req.body;
  if (!text) return res.status(400).json({ error: 'text is required' });

  const mdPath = getMdPathForThread(id);
  if (!mdPath) return res.status(404).json({ error: 'Thread not found' });

  const threads = store.getThreads(mdPath);
  const thread = threads.find(t => t.id === id);
  if (!thread) return res.status(404).json({ error: 'Thread not found' });

  const msgCount = thread.messages.length;
  const messageId = `${id}_m${msgCount}`;
  const now = new Date().toISOString();
  const message = { id: messageId, text, author: author || null, createdAt: now };

  store.addReply(mdPath, id, message);
  res.json({ success: true, message });
});

// POST /api/thread/:id/resolve
// Body: { comment? }
app.post('/api/thread/:id/resolve', (req, res) => {
  const { id } = req.params;
  const { comment } = req.body;

  const mdPath = getMdPathForThread(id);
  if (!mdPath) return res.status(404).json({ error: 'Thread not found' });

  if (!store.resolveThread(mdPath, id, comment)) {
    return res.status(404).json({ error: 'Thread not found' });
  }

  res.json({ success: true });
});

// DELETE /api/thread/:id
app.delete('/api/thread/:id', (req, res) => {
  const { id } = req.params;

  const mdPath = getMdPathForThread(id);
  if (!mdPath) return res.status(404).json({ error: 'Thread not found' });

  if (!store.deleteThread(mdPath, id)) {
    return res.status(404).json({ error: 'Thread not found' });
  }

  threadIndex.delete(id);
  res.json({ success: true });
});

// ─── Start ────────────────────────────────────────────────────────────────────

buildDocMap();

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`CORS: ${ALLOWED_ORIGINS}`);
  console.log(`Storage: JSON sidecar files`);
  if (DOCS_DIR) {
    console.log(`Docs: ${path.resolve(DOCS_DIR)} (${docMap.size} files)`);
  } else {
    console.log(`Mode: dev (sample.md)`);
  }
});
