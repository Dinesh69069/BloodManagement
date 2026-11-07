import { User } from '../models/user.model.js';
import { env } from '../config/environment.js';

export function flash(req, type, message) {
  req.session.flashMessages = [...(req.session.flashMessages || []), { type, message }];
}

export function requireLogin(req, res, next) {
  if (!req.session.user) {
    if (req.originalUrl.startsWith('/api/')) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    flash(req, 'warning', 'Please log in to continue.');
    return res.redirect('/login');
  }
  return next();
}

export async function requireAdmin(req, res, next) {
  try {
    const user = await User.findById(req.session.user.id).select('role').lean();
    if (!user) {
      return req.session.destroy((error) => {
        if (error) return next(error);
        res.clearCookie('lifeline.sid');
        if (req.originalUrl.startsWith('/api/')) {
          return res.status(401).json({ success: false, error: 'User account not found' });
        }
        return res.redirect('/login');
      });
    }
    req.session.user.role = user.role;
    if (user.role !== 'admin') {
      if (req.originalUrl.startsWith('/api/')) {
        return res.status(403).json({ success: false, error: 'Administrator access required' });
      }
      flash(req, 'danger', 'Administrator access is required.');
      return res.redirect('/dashboard');
    }
    return next();
  } catch (error) {
    next(error);
  }
}

export function activeAccountMiddleware(req, res, next) {
  if (!req.session.user) return next();
  User.findById(req.session.user.id).select('accountStatus role fullName').lean()
    .then((user) => {
      if (user?.accountStatus === 'active') {
        req.session.user.role = user.role;
        req.session.user.name = user.fullName;
        return next();
      }
      return req.session.destroy((error) => {
        if (error) return next(error);
        res.clearCookie('lifeline.sid', {
          httpOnly: true,
          sameSite: 'lax',
          secure: env.isProduction,
        });
        if (req.originalUrl.startsWith('/api/')) {
          return res.status(401).json({ success: false, error: 'Account is no longer active' });
        }
        return res.redirect('/login');
      });
    })
    .catch(next);
}

