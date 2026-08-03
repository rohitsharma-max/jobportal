// Escapes a value before it is interpolated into an HTML email body.
//
// Notification templates embed applicant-supplied data — `name` comes straight
// from the application form. Without this, a name like
// `<a href="http://evil.example">Click here</a>` is delivered as live markup in
// the message body. Mail clients are not a trusted rendering context to hand
// unescaped user input to, even when the recipient is the applicant themselves.
const ENTITIES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"']/g, (char) => ENTITIES[char]);
}

module.exports = escapeHtml;
