import { env } from '../config/environment.js';
import { removeDonorPhoto } from './upload.middleware.js';

export function logServerError(error) {
  const details = error instanceof Error ? error.stack || error.message : String(error);
  console.error(details.replace(/mongodb(?:\+srv)?:\/\/[^\s"'<>]+/gi, '[MongoDB URI]'));
}

export function notFoundHandler(req, res) {
  if (req.originalUrl.startsWith('/api/')) {
    return res.status(404).json({ success: false, error: 'Resource not found' });
  }
  res.status(404).render('error', {
    title: 'Page not found',
    message: 'We could not find the page you requested.',
  });
}

export function globalErrorHandler(error, req, res, next) {
  logServerError(error);
  if (req.file) removeDonorPhoto(req.file.filename).catch(logServerError);
  if (res.headersSent) return next(error);

  const isApi = req.originalUrl.startsWith('/api/');

  if (error?.name === 'ValidationError' || error?.name === 'CastError') {
    if (isApi) {
      return res.status(400).json({ success: false, error: 'Invalid data format or validation failed.' });
    }
    return res.status(400).render('error', {
      title: 'Invalid information',
      message: 'Please check the information you submitted and try again.',
    });
  }

  if (req.method === 'GET' && req.path === '/donors') {
    return res.status(500).render('error', {
      title: 'Donor search unavailable',
      message: 'We could not load donor results right now. Please try your search again in a moment.',
    });
  }

  if (isApi) {
    return res.status(500).json({
      success: false,
      error: env.isProduction
        ? 'Internal server error occurred.'
        : error.message || 'Server error',
    });
  }

  res.status(500).render('error', {
    title: 'Something went wrong',
    message: env.isProduction
      ? 'The request could not be completed. Please try again later.'
      : 'The server could not complete this request. Check the server console for details.',
  });
}

