# CLAUDE.md — markdown-comment-sidecar

## What this is

A proof-of-concept for annotating markdown files with threaded comments without modifying the source file. Comments are stored in a sidecar `comments.json` and re-anchored to the document on each load using fuzzy text matching.

## Stack

- **Server**: Node.js + Express, no build step
- **Rendering**: `marked` converts markdown to HTML server-side
- **Anchoring**: `diff-match-patch` for fuzzy re-anchoring of comment positions
- **Frontend**: Vanilla JS + HTML/CSS, no framework, no bundler
- **Storage**: `comments.json` flat file (array of thread objects)

Run with `npm start` — server on port 3000.

## File layout

```
server.js          — Express API + re-anchoring logic
public/
  index.html       — All CSS + HTML shell
  app.js           — All frontend logic (no modules)
sample.md          — The document being annotated
comments.json      — Thread storage (auto-created)
```

## Data model

Threads in `comments.json`:

```json
{
  "id": "thread_1234",
  "anchor": {
    "context": "the selected text",
    "prefix": "20 chars before",
    "suffix": "20 chars after",
    "offset_guess": 420
  },
  "messages": [
    { "id": "thread_1234_m0", "text": "first comment", "createdAt": "..." },
    { "id": "thread_1234_m1", "text": "a reply", "createdAt": "..." }
  ],
  "resolved": false,
  "resolvedAt": null,
  "resolvedComment": null
}
```

Old single-comment format (`{ id, text, anchor, createdAt }`) is auto-migrated to thread format in `loadThreads()`.

## Re-anchoring (`reAnchor` in server.js)

On every GET /api/document, each thread's anchor is re-resolved against the current markdown source to find the text's current position even if the document has changed.

**Critical gotcha**: `diff-match-patch` has `Match_MaxBits = 32`. The search pattern is `prefix + context + suffix` (up to 60+ chars), which almost always exceeds 32. Setting `Match_MaxBits = 0` does NOT disable the limit — it makes every pattern fail (`pattern.length > 0` is always true). The fix: when `searchStr.length > dmp.Match_MaxBits`, fall back to `String.indexOf()` instead of fuzzy matching.

Re-anchoring returns `currentOffset` (start of `context` in markdown) and `orphaned: true` if not found.

## DOM highlight strategy (`findTextInDOM` in app.js)

The frontend can't use `currentOffset` directly in the rendered HTML because markdown syntax is stripped (headings lose `#`, bold loses `**`, etc.). Instead:

1. Walk all text nodes in the rendered DOM with `TreeWalker`
2. Concatenate them into `combined` string, tracking each node's start position
3. Search for `anchor.context` in `combined` with `indexOf`
4. Map start/end indices back to `{ node, offset }` pairs

**Critical gotcha**: `nodeAt(offset)` uses strict `offset < node.start + node.length`. For the end position, use `allowAtEnd = true` (i.e., `<=`) so that a selection ending exactly at a text node boundary doesn't fall through to the last node in the document — which would wrap everything from mid-document to the end in a `<mark>`.

## Frontend state

```js
state = {
  markdown: '',        // raw source
  html: '',            // rendered HTML from server
  threads: [],         // re-anchored threads from GET /api/document
  selection: null,     // { text, offset } of current text selection
  view: 'preview',     // 'preview' | 'markdown'
  sidebarMode: 'list', // 'list' | 'thread'
  sidebarTab: 'active',// 'active' | 'resolved'
  activeThreadId: null,
}
```

## API

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/document` | Returns `{ html, markdown, threads[] }` |
| POST | `/api/comment` | Create new thread `{ text, selectedText, offset }` |
| POST | `/api/thread/:id/reply` | Add reply `{ text }` |
| POST | `/api/thread/:id/resolve` | Resolve thread `{ comment? }` |
| DELETE | `/api/thread/:id` | Delete thread |

## Sidebar behaviour

- **List view**: shows all open threads (Active tab) or resolved threads (Resolved tab). Each card shows first message, separator + last message if >1, reply count badge or "Resolved" badge.
- **Thread view**: full conversation, reply input at bottom, split Resolve button (Resolve / Resolve with comment dropdown).
- Resolved threads have **no document highlight** unless they are the `activeThreadId`. Opening a resolved thread triggers a full `renderView()` to inject the highlight; closing it removes it.
- Non-resolved thread open/close only updates CSS classes (no re-render).

## Views

- **Preview**: rendered HTML, `mark.cmt-highlight` elements injected via DOM Range API
- **Markdown**: raw `<pre>` with `<mark>` spans injected via string escaping at `currentOffset` positions. Comments can be created in both views.

## Known limitations (POC scope)

- Comments added in markdown view with syntax characters (e.g. `**bold**`) anchor to raw markdown text — they highlight correctly in markdown view but won't find the text in preview view (rendered DOM has no asterisks).
- No multi-user support; `comments.json` has no locking.
- No persistence beyond the flat file.
