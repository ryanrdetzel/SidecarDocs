// ─── Recent Documents ─────────────────────────────────────────────────────────
// Self-contained: runs on both doc pages (with SIDECAR_CONFIG) and index pages.

(function () {
  const _cfg = window.SIDECAR_CONFIG || {};

  function _esc(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/'/g, '&#39;').replace(/"/g, '&quot;');
  }

  function getRecentDocs() {
    try { return JSON.parse(localStorage.getItem('sidecar_recent_docs') || '[]'); }
    catch { return []; }
  }

  function saveRecentDocs(docs) {
    localStorage.setItem('sidecar_recent_docs', JSON.stringify(docs));
  }

  function _sortAndTrim(docs) {
    docs.sort((a, b) => {
      const aFav = !!a.favoritedAt, bFav = !!b.favoritedAt;
      if (aFav !== bFav) return aFav ? -1 : 1;
      if (aFav && bFav) return new Date(b.favoritedAt) - new Date(a.favoritedAt);
      const aTime = Math.max(new Date(a.viewedAt || 0), new Date(a.commentedAt || 0));
      const bTime = Math.max(new Date(b.viewedAt || 0), new Date(b.commentedAt || 0));
      return bTime - aTime;
    });
    const favorited = docs.filter(d => d.favoritedAt);
    const nonFavorited = docs.filter(d => !d.favoritedAt).slice(0, Math.max(0, 20 - favorited.length));
    return [...favorited, ...nonFavorited];
  }

  function upsertRecentDoc(fields) {
    const docs = getRecentDocs();
    const idx = docs.findIndex(d => d.documentId === fields.documentId);
    if (idx >= 0) {
      docs[idx] = { ...docs[idx], ...fields };
    } else {
      docs.unshift({ viewedAt: null, commentedAt: null, favoritedAt: null, ...fields });
    }
    saveRecentDocs(_sortAndTrim(docs));
  }

  function trackRecentView() {
    if (!_cfg.documentId) return;
    upsertRecentDoc({
      documentId: _cfg.documentId,
      title: document.title,
      url: window.location.pathname + window.location.search,
      viewedAt: new Date().toISOString(),
    });
  }

  function trackRecentComment() {
    if (!_cfg.documentId) return;
    upsertRecentDoc({
      documentId: _cfg.documentId,
      title: document.title,
      url: window.location.pathname + window.location.search,
      commentedAt: new Date().toISOString(),
    });
  }

  function toggleFavorite(documentId) {
    const docs = getRecentDocs();
    const doc = docs.find(d => d.documentId === documentId);
    if (!doc) return;
    upsertRecentDoc({ documentId, favoritedAt: doc.favoritedAt ? null : new Date().toISOString() });
  }

  function buildRecentItem(doc) {
    const isCurrent = _cfg.documentId && doc.documentId === _cfg.documentId;
    const isFav = !!doc.favoritedAt;
    const star = isFav ? '★' : '☆';
    const currentClass = isCurrent ? ' current' : '';
    const title = _esc(doc.title || doc.documentId);
    const url = _esc(doc.url || '#');
    const badge = doc.commentedAt ? '<span class="recent-comment-badge" title="Has comments">💬</span>' : '';
    return `<div class="recent-item${currentClass}">` +
      `<button class="recent-star" data-doc-id="${_esc(doc.documentId)}" title="${isFav ? 'Unfavorite' : 'Favorite'}">${star}</button>` +
      `<a href="${url}" class="recent-item-link">${title}</a>` +
      `${badge}</div>`;
  }

  function renderRecentDropdown() {
    const dropdown = document.getElementById('recent-dropdown');
    if (!dropdown) return;
    const docs = getRecentDocs();
    const favorited = docs.filter(d => d.favoritedAt);
    const recent = docs.filter(d => !d.favoritedAt);

    if (docs.length === 0) {
      dropdown.innerHTML = '<div class="recent-empty">No recently visited documents yet</div>';
      return;
    }

    const showSections = favorited.length > 0 && recent.length > 0;
    let html = '';
    if (favorited.length > 0) {
      if (showSections) html += '<div class="recent-section-header">Favorites</div>';
      html += favorited.map(buildRecentItem).join('');
    }
    if (recent.length > 0) {
      if (showSections) html += '<div class="recent-section-header">Recent</div>';
      html += recent.map(buildRecentItem).join('');
    }
    dropdown.innerHTML = html;

    dropdown.querySelectorAll('.recent-star').forEach(btn => {
      btn.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        toggleFavorite(btn.dataset.docId);
        renderRecentDropdown();
      });
    });
  }

  // Wire up dropdown open/close (scripts run at bottom of body, DOM is ready)
  const btnRecent = document.getElementById('btn-recent');
  const recentDropdown = document.getElementById('recent-dropdown');

  if (btnRecent && recentDropdown) {
    btnRecent.addEventListener('click', e => {
      e.stopPropagation();
      const isOpen = !recentDropdown.classList.contains('hidden');
      if (isOpen) {
        recentDropdown.classList.add('hidden');
      } else {
        renderRecentDropdown();
        recentDropdown.classList.remove('hidden');
      }
    });

    document.addEventListener('click', e => {
      if (!btnRecent.closest('.recent-wrapper').contains(e.target)) {
        recentDropdown.classList.add('hidden');
      }
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !recentDropdown.classList.contains('hidden')) {
        recentDropdown.classList.add('hidden');
      }
    });
  }

  // Expose tracking functions for app.js to call
  window.trackRecentView = trackRecentView;
  window.trackRecentComment = trackRecentComment;
})();
