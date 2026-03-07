# markdown-comment-sidecar

A proof-of-concept for adding threaded comments to a markdown document without touching the source file. Comments live in a sidecar `comments.json` and are re-anchored to the document on every load, so they survive edits to the surrounding text.

## Features

- **Non-destructive** — the markdown source is never modified
- **Threaded conversations** — each annotation is a thread; anyone can reply
- **Fuzzy re-anchoring** — comments stay attached to their text even as the document is edited
- **Resolve workflow** — resolve threads with an optional closure comment; resolved threads move to a separate tab
- **Two views** — toggle between rendered preview and raw markdown source; highlights appear in both
- **Orphan detection** — if anchor text is deleted, the comment is flagged as orphaned rather than silently lost

## Quick start

```bash
npm install
npm start
# open http://localhost:3000
```

## How to use

### Adding a comment

1. Select any text in the document
2. Click the **+ Add Comment** button that appears above the selection
3. Type your comment and submit (or Cmd/Ctrl+Enter)

The selected text is highlighted in yellow. The comment appears in the sidebar.

### Replying

Click any comment card in the sidebar to open the thread view. Type in the reply box at the bottom and hit **Reply** (or Cmd/Ctrl+Enter).

### Resolving a thread

From the thread view, use the green **Resolve** button:

- **Resolve** — marks the thread resolved immediately
- **▾ → Resolve with comment** — expands a form to add a final note explaining the resolution before closing

Resolved threads move to the **Resolved** tab in the sidebar. Their document highlight is removed; it reappears temporarily when you open the thread from the sidebar.

### Switching views

The **Preview / Markdown** toggle in the top-right switches between the rendered HTML view and the raw markdown source. Comments can be added and viewed in either mode.

## How anchoring works

When you select text, the system records:

- **context** — the selected text itself
- **prefix** — 20 characters before the selection
- **suffix** — 20 characters after the selection
- **offset_guess** — character position in the markdown source

On every page load, each comment is re-anchored against the current markdown source. For short patterns the library uses fuzzy (bitap) matching; for longer selections it falls back to exact `indexOf`. If the text can no longer be found, the comment is marked **orphaned** and shown in red.

## Project structure

```
server.js        Express server, re-anchoring logic, REST API
public/
  index.html     HTML shell + all CSS
  app.js         All frontend logic (vanilla JS)
sample.md        The document being annotated
comments.json    Thread storage (created automatically)
```

## API

| Endpoint | Method | Body | Description |
|---|---|---|---|
| `/api/document` | GET | — | Rendered HTML, markdown source, and re-anchored threads |
| `/api/comment` | POST | `{ text, selectedText, offset }` | Create a new thread |
| `/api/thread/:id/reply` | POST | `{ text }` | Add a reply to a thread |
| `/api/thread/:id/resolve` | POST | `{ comment? }` | Resolve a thread |
| `/api/thread/:id` | DELETE | — | Delete a thread entirely |

## Dependencies

| Package | Purpose |
|---|---|
| `express` | HTTP server |
| `marked` | Markdown → HTML rendering |
| `diff-match-patch` | Fuzzy text matching for re-anchoring |
