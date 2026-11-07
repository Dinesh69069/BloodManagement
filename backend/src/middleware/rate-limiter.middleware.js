import { rateLimit } from 'express-rate-limit';

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: 'Too many attempts. Please wait a few minutes and try again.',
});

const publicSubmissionPaths = new Set(['/donor/register', '/blood-banks/suggest', '/contact']);
const createPublicSubmissionLimiter = () => rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});

const publicSubmissionLimiters = new Map(
  [...publicSubmissionPaths].map((route) => [route, createPublicSubmissionLimiter()]),
);

export function publicSubmissionLimiterMiddleware(req, res, next) {
  const limiter = req.method === 'POST' ? publicSubmissionLimiters.get(req.path) : null;
  return limiter ? limiter(req, res, next) : next();
}

