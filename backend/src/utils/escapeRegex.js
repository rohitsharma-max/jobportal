// Escapes regex metacharacters in user input before it is used to build a
// RegExp. Without this, a search term like "(a+)+$" becomes a catastrophic
// backtracking pattern that can hang the event loop (ReDoS), and characters
// like "." or ".*" silently widen the match beyond what the user typed.
function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = escapeRegex;
