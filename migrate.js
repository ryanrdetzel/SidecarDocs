// One-shot migration: comments.json -> comments.db
// Run: node migrate.js [--documentId local]

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const documentId = process.argv.includes('--documentId')
  ? process.argv[process.argv.indexOf('--documentId') + 1]
  : 'local';

const JSON_PATH = path.join(__dirname, 'comments.json');
const DB_PATH = path.join(__dirname, 'comments.db');

if (!fs.existsSync(JSON_PATH)) {
  console.log('No comments.json found, nothing to migrate.');
  process.exit(0);
}

const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');

const raw = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));

const insertThread = db.prepare(`
  INSERT OR IGNORE INTO threads
    (id, document_id, anchor_context, anchor_prefix, anchor_suffix, anchor_offset_guess, resolved, resolved_at, resolved_comment, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertMessage = db.prepare(`
  INSERT OR IGNORE INTO messages (id, thread_id, text, author, created_at)
  VALUES (?, ?, ?, NULL, ?)
`);

let threadCount = 0;
let messageCount = 0;

const migrate = db.transaction(() => {
  for (const item of raw) {
    // Handle old single-comment format
    const thread = item.messages ? item : {
      ...item,
      messages: [{ id: item.id + '_m0', text: item.text, createdAt: item.createdAt }],
    };

    const anchor = thread.anchor || {};
    insertThread.run(
      thread.id,
      documentId,
      anchor.context || '',
      anchor.prefix || '',
      anchor.suffix || '',
      anchor.offset_guess || 0,
      thread.resolved ? 1 : 0,
      thread.resolvedAt || null,
      thread.resolvedComment || null,
      thread.messages[0]?.createdAt || new Date().toISOString(),
    );
    threadCount++;

    for (const msg of thread.messages) {
      insertMessage.run(msg.id, thread.id, msg.text, msg.createdAt);
      messageCount++;
    }
  }
});

migrate();
console.log(`Migrated ${threadCount} threads, ${messageCount} messages -> documentId "${documentId}"`);
