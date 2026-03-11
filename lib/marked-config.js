// Configure marked to escape raw HTML blocks so injected HTML can't execute scripts.
const { marked } = require('marked');

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-');
}

marked.use({
  renderer: {
    // marked v9 may pass `text` instead of `raw` in certain rendering paths
    html({ raw, text }) {
      const content = raw || text || '';
      return content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    },
    heading(text, depth, raw) {
      const id = slugify(raw);
      return `<h${depth} id="${id}">${text}</h${depth}>\n`;
    },
  },
});

module.exports = { marked };
