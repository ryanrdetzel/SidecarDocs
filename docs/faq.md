---
title: FAQ
id: faq
---

# Frequently Asked Questions

Common questions about markdown-comment-sidecar.

## General

### What problem does this solve?

Most documentation platforms bolt comments onto the publishing layer — you get Disqus at the bottom of the page, or GitHub Discussions linked from a sidebar. Neither anchors comments to a specific passage in the document.

markdown-comment-sidecar lets readers highlight *any* text and attach a threaded discussion to it. The comment lives next to the passage, not at the bottom of the page.

### Does it modify my markdown files?

No. Your source files are never touched. All comment data lives in a separate SQLite database (`comments.db`) on the comment server.

### Is it production-ready?

It's a proof of concept. The API has no authentication by default, which means anyone who knows a document's ID can read and write comments on it. See [Deployment](deployment.html) for hardening advice before exposing it publicly.

### What happens if I edit the document after comments are added?

Comments are anchored to *elements* (the nth heading, the nth paragraph) rather than character offsets. Minor edits to surrounding text usually don't break anchors. If you add or remove elements before the anchor, the comment may shift to the wrong element. A text snapshot (`anchor_element_text`) is stored so drift can be detected — though automatic re-anchoring is not yet implemented.

### Can I use it with non-markdown documents?

The server stores comments against any `documentId` string. The rendering pipeline is markdown-specific, but you could adapt `build.js` to inject the sidecar into HTML pages generated from any source.

---

## Setup

### What are the minimum requirements?

- Node.js 18 or later
- npm

No database server. No framework. SQLite runs in-process via `better-sqlite3`.

### How do I generate a site ID?

```bash
node -e "console.log(require('crypto').randomUUID())"
```

Store the result somewhere safe. Changing it orphans all existing comments.

### Can I run the comment server on a different host than the docs?

Yes. Set `--server` to the full URL of your comment server when building:

```bash
node build.js \
  --input ./docs \
  --output ./dist \
  --server https://comments.example.com \
  --site-id <your-site-id> \
  --assets-url https://comments.example.com
```

Configure `ALLOWED_ORIGINS` on the server to allow the docs origin.

---

## Comments

### Who can leave comments?

By default, anyone who can reach the comment server. There is no auth layer in the POC. You can add middleware to `server.js` to gate on a session cookie or API key.

### Can I export comments?

The `comments.db` file is a standard SQLite database. Use any SQLite client to export threads and messages:

```bash
sqlite3 comments.db ".headers on" ".mode csv" "SELECT * FROM threads;" > threads.csv
sqlite3 comments.db ".headers on" ".mode csv" "SELECT * FROM messages;" > messages.csv
```

### Can I delete a comment thread?

Yes. `DELETE /api/thread/:id` removes the thread and all its messages (cascade delete).

### What is "resolve with comment"?

When resolving a thread you can optionally leave a closing note — useful for explaining why an issue was closed or what action was taken. The note is stored in `resolved_comment` on the thread record.

---

## Deployment

### Can I host the docs on GitHub Pages?

Yes. See the [GitHub Pages guide](guides/github-pages.html).

### Does the comment server need a persistent disk?

Yes — `comments.db` must survive restarts. On container platforms, mount a persistent volume at the path where `comments.db` is written. On Railway, Render, or Fly.io, use a volume attachment. On a plain VPS, the file is already persistent.

### Can I use a hosted database instead of SQLite?

Not without code changes. The server uses `better-sqlite3` throughout. Migrating to Postgres would require swapping the query layer in `server.js`.
