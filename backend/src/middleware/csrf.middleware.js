import { randomBytes } from 'node:crypto';
import { removeDonorPhoto } from './upload.middleware.js';
import { BLOOD_GROUPS } from '../utils/blood.util.js';

export function setupViewLocals(req, res, next) {
  if (!req.session.csrfToken) req.session.csrfToken = randomBytes(32).toString('hex');
  res.locals.currentUser = req.session.user || null;
  res.locals.csrfToken = req.session.csrfToken;
  res.locals.bloodGroups = BLOOD_GROUPS;
  res.locals.currentYear = new Date().getFullYear();
  res.locals.flashMessages = req.session.flashMessages || [];
  delete req.session.flashMessages;
  next();
}

export function verifyCsrf(req, res, next) {
  if (req.method !== 'POST') return next();
  // Allow API routes using custom header if wanted
  if (req.path.startsWith('/api/')) return next();

  const token = req.body?.csrfToken;
  if (typeof token !== 'string' || token !== req.session.csrfToken) {
    if (req.file) removeDonorPhoto(req.file.filename).catch(() => {});
    return res.status(403).render('error', {
      title: 'Request expired',
      message: 'This form expired or could not be verified. Please refresh the page and try again.',
    });
  }
  next();
}

