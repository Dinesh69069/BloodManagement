import express from 'express';
import session from 'express-session';
import { env } from './config/environment.js';
import { COMPATIBLE_DONORS } from './utils/blood.util.js';
import { helmetSecurity } from './middleware/security.middleware.js';
import { activeAccountMiddleware } from './middleware/auth.middleware.js';
import { setupViewLocals, verifyCsrf } from './middleware/csrf.middleware.js';
import { publicSubmissionLimiterMiddleware } from './middleware/rate-limiter.middleware.js';
import { handleDonorPhotoUpload } from './middleware/upload.middleware.js';
import { notFoundHandler, globalErrorHandler } from './middleware/error.middleware.js';
import routes from './routes/index.js';

const app = express();

if (env.trustProxyHops) app.set('trust proxy', env.trustProxyHops);

// View engine setup
app.set('view engine', 'ejs');
app.set('views', env.paths.views);
app.locals.compatibleDonors = COMPATIBLE_DONORS;

// Security & Parsing
app.use(helmetSecurity);
app.use(express.json());
app.use(express.urlencoded({ extended: false, limit: '20kb' }));
app.use(express.static(env.paths.public));

// Session Setup
export const sessionOptions = {
  name: 'lifeline.sid',
  secret: env.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.isProduction,
    maxAge: 1000 * 60 * 60 * 24 * 7,
  },
};

let sessionMiddleware = env.isProduction
  ? null
  : session({
    ...sessionOptions,
    store: new session.MemoryStore(),
  });

export function setSessionStore(store) {
  sessionMiddleware = session({
    ...sessionOptions,
    store,
  });
}

app.use((req, res, next) => {
  if (!sessionMiddleware) return next(new Error('The persistent session store is not ready.'));
  return sessionMiddleware(req, res, next);
});

// Middleware pipeline
app.use(activeAccountMiddleware);
app.use(setupViewLocals);
app.use(publicSubmissionLimiterMiddleware);
app.use(handleDonorPhotoUpload);
app.use(verifyCsrf);

// Routes
app.use(routes);

// Error handling
app.use(notFoundHandler);
app.use(globalErrorHandler);

export { app };

