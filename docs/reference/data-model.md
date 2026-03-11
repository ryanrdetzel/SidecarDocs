---
title: Data Model
---

# Data Model

markdown-comment-sidecar stores all comment data in a SQLite database (`comments.db`). There are two tables: `threads` and `messages`.

## Schema

```sql
CREATE TABLE threads (
  id                   TEXT PRIMARY KEY,
  document_id          TEXT NOT NULL,
  anchor_element_type  TEXT,
  anchor_element_index INT,
  anchor_element_text  TEXT,
  anchor_selected_text TEXT,
  resolved             INT  DEFAULT 0,
  resolved_at          TEXT,
  resolved_comment     TEXT,
  created_at           TEXT
);

CREATE TABLE messages (
  id         TEXT PRIMARY KEY,
  thread_id  TEXT REFERENCES threads(id) ON DELETE CASCADE,
  text       TEXT,
  author     TEXT,
  created_at TEXT
);
```

---

## Threads

### `id`

UUID generated server-side. Stable for the lifetime of the thread.

### `document_id`

32-character hex string identifying the document. Derived from:

```
sha256(siteId + ':' + relativeFilePath).slice(0, 32)
```

In dev mode (`npm start`), this is always `'local'`.

### `anchor_element_type`

The HTML tag of the anchored element — `h1`, `h2`, `h3`, `p`, `li`, `blockquote`, etc. Corresponds to the element types produced by `marked` when rendering the source markdown.

### `anchor_element_index`

Zero-based index of the anchored element among all elements of the same type in the document. For example, `anchor_element_type: "p", anchor_element_index: 2` means the third paragraph.

### `anchor_element_text`

Text content of the anchor element at the time the comment was created. Used to detect drift — if the element at the stored index no longer has this text, the anchor has shifted.

### `anchor_selected_text`

The exact text that was highlighted when the comment was created. Stored for display purposes (shown in thread cards) and for future re-anchoring logic.

### `resolved` / `resolved_at` / `resolved_comment`

`resolved` is `0` or `1`. When a thread is resolved, `resolved_at` is set to an ISO 8601 timestamp and `resolved_comment` stores an optional closing note.

Resolved threads are excluded from highlight injection unless they are the currently active thread.

---

## Messages

### `id`

UUID generated server-side.

### `thread_id`

Foreign key to `threads.id`. Cascade-deletes with the thread.

### `text`

Raw message content. No sanitization is applied server-side — the frontend escapes it when rendering.

### `author`

Display name string. In the POC this comes from the request body; in a production deployment it would come from a verified session.

### `created_at`

ISO 8601 timestamp string. Set server-side at insert time.

---

## Indexes

`document_id` is not indexed by default. For large deployments with many documents, add:

```sql
CREATE INDEX idx_threads_document_id ON threads(document_id);
```

---

## Inspecting the database

```bash
# List all threads for a document
sqlite3 comments.db \
  "SELECT id, anchor_element_type, anchor_element_index, resolved FROM threads WHERE document_id='<id>';"

# Show full thread with messages
sqlite3 comments.db \
  "SELECT t.id, t.anchor_selected_text, m.author, m.text
   FROM threads t JOIN messages m ON m.thread_id = t.id
   WHERE t.id='<thread-id>';"
```
