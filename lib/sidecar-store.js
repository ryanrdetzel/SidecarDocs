const fs = require('fs');

function sidecarPath(mdFilePath) {
  return mdFilePath + '.comments.json';
}

function readThreads(mdFilePath) {
  const p = sidecarPath(mdFilePath);
  if (!fs.existsSync(p)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    return data.threads || [];
  } catch {
    return [];
  }
}

function writeThreads(mdFilePath, threads) {
  const p = sidecarPath(mdFilePath);
  fs.writeFileSync(p, JSON.stringify({ threads }, null, 2) + '\n');
}

function getThreads(mdFilePath) {
  return readThreads(mdFilePath);
}

function addThread(mdFilePath, thread) {
  const threads = readThreads(mdFilePath);
  threads.push(thread);
  writeThreads(mdFilePath, threads);
  return thread;
}

function findThreadInFile(mdFilePath, threadId) {
  const threads = readThreads(mdFilePath);
  const idx = threads.findIndex(t => t.id === threadId);
  return idx >= 0 ? { threads, idx } : null;
}

function addReply(mdFilePath, threadId, message) {
  const result = findThreadInFile(mdFilePath, threadId);
  if (!result) return null;
  result.threads[result.idx].messages.push(message);
  writeThreads(mdFilePath, result.threads);
  return message;
}

function resolveThread(mdFilePath, threadId, comment) {
  const result = findThreadInFile(mdFilePath, threadId);
  if (!result) return false;
  const thread = result.threads[result.idx];
  thread.resolved = true;
  thread.resolvedAt = new Date().toISOString();
  thread.resolvedComment = comment || null;
  writeThreads(mdFilePath, result.threads);
  return true;
}

function deleteThread(mdFilePath, threadId) {
  const result = findThreadInFile(mdFilePath, threadId);
  if (!result) return false;
  result.threads.splice(result.idx, 1);
  writeThreads(mdFilePath, result.threads);
  return true;
}

module.exports = { sidecarPath, readThreads, writeThreads, getThreads, addThread, addReply, resolveThread, deleteThread };
