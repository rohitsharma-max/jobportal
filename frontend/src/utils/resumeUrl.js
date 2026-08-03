/**
 * Decides whether a resume URL may be rendered in an iframe.
 *
 * `resumeLink` is either a Cloudinary URL this app uploaded, or an arbitrary URL
 * the applicant typed into the form. The admin review table used to iframe both.
 * Framing an attacker-chosen page inside the admin view is not something to do
 * on purpose: it cannot read the admin DOM (different origin), but it renders
 * hostile content in a trusted-looking position, which is the setup for UI
 * redress — a fake "session expired, sign in again" panel, for instance.
 *
 * So: frame only what we uploaded. Everything else gets a plain link the admin
 * opens deliberately, in its own tab, where the browser's own chrome makes it
 * obvious they have left the app.
 */

const CLOUDINARY_HOST = 'res.cloudinary.com';
const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || '';

export function isEmbeddableResume(rawUrl) {
  if (!rawUrl) return false;

  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return false; // not parseable, so certainly not ours
  }

  // Scheme check first: the backend already rejects anything but http(s) at
  // submission time, but records predating that rule may still be stored.
  if (url.protocol !== 'https:') return false;
  if (url.hostname !== CLOUDINARY_HOST) return false;

  // Cloudinary paths are /<cloud_name>/<resource_type>/<delivery>/…, so with the
  // cloud name configured we can require the asset be from OUR cloud rather than
  // from any of Cloudinary's other customers.
  if (CLOUD_NAME) return url.pathname.startsWith(`/${CLOUD_NAME}/`);

  return true;
}
