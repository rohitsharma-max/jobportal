// Sends email via Nodemailer using Gmail credentials from .env.
// If credentials are missing, it logs and no-ops so the app still works.
const nodemailer = require('nodemailer');

const isConfigured = Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS);

let transporter = null;
if (isConfigured) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS, // a Gmail "App Password", not the account password
    },
  });
}

async function sendEmail({ to, subject, html }) {
  if (!isConfigured) {
    console.log(`✉️  (email skipped — EMAIL_USER/EMAIL_PASS not set) would send "${subject}" to ${to}`);
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
