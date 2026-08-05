// Sends email via Nodemailer using Gmail credentials from .env.
// If credentials are missing, it logs and no-ops so the app still works.
const nodemailer = require('nodemailer');

const isConfigured = Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS);

let transporter = null;
if (isConfigured) {
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

async function sendEmail({ to, subject, html }) {
  if (!isConfigured) {
    // Silent under test: the suite exercises this branch constantly, and the
    // notice would bury the actual test output.
    if (process.env.NODE_ENV !== 'test') {
      console.log(
        `✉️  (email skipped — EMAIL_USER/EMAIL_PASS not set) would send "${subject}" to ${to}`
      );
    }
    return;
  }
  await transporter.sendMail({
    from: `"Job Portal" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
  });
}

module.exports = sendEmail;
// Callers need to distinguish "mail sent" from "mail silently skipped". Once an
// OTP gates registration, a silent skip means nobody can ever sign up.
module.exports.isEmailConfigured = isConfigured;
