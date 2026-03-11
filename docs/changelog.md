---
title: Changelog
---

# Changelog

Notable changes to markdown-comment-sidecar, newest first.

---

## Unreleased

### Added
- `--base-path` flag for sites hosted at a sub-path (e.g. `/docs`)
- Logo branding option via `--logo` build flag
- Search across all documents in the built site

### Fixed
- Highlight injection now handles nested inline elements correctly
- Document ID derivation is consistent across platforms (fixes Windows path separator issue)

---

## 0.4.0 — 2024-11-12

### Added
- **Resolved threads tab** — sidebar now has Active / Resolved tabs
- **Resolve with comment** — split button lets you leave a closing note when resolving
- Reply count badge on thread cards

### Changed
- Thread cards show first message + last message (when >1 reply) instead of truncating the first message
- Sidebar open/close no longer triggers a full re-render for non-resolved threads

### Fixed
- Thread highlight persists when sidebar is in list view
- Selected text is preserved in the anchor even when the selection spans multiple elements

---

## 0.3.0 — 2024-10-01

### Added
- **Static site builder** — `build.js` generates standalone HTML from a `docs/` directory
- `--site-id` flag for stable, salted document ID derivation
- `--assets-url` flag to serve CSS and JS from the comment server
- Auto-generated index pages for directories that don't have one
- GitHub Actions workflow example for deploying to GitHub Pages

### Changed
- Document IDs are now derived from `sha256(siteId + ':' + relativeFilePath)` instead of using the file path directly
- Frontmatter `id` field can pin a document ID (useful after file renames)

### Removed
- `documentPath` query parameter — replaced by `documentId`

---

## 0.2.0 — 2024-09-03

### Added
- **Markdown view** — toggle between rendered preview and raw source; comments can be created in both views
- `DELETE /api/thread/:id` endpoint
- `anchor_selected_text` stored on threads (the exact highlighted passage)

### Changed
- Anchoring uses element type + index + text snapshot (previously just index)
- Sidebar is now a fixed panel rather than an overlay

### Fixed
- Comment highlights no longer disappear after a reply is submitted
- Resolved threads are excluded from highlight injection by default

---

## 0.1.0 — 2024-08-15

Initial proof-of-concept release.

- Express server with SQLite backing via `better-sqlite3`
- Element-based comment anchoring (type, index, text snapshot)
- Threaded comments — create thread, reply, resolve, delete
- Highlight injection via DOM Range API (preview) and string escaping (markdown view)
- Dev mode with `sample.md`
