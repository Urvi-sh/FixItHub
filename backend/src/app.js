const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoSanitize = require('express-mongo-sanitize');
const rateLimit = require('express-rate-limit');
const path = require('path');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middlewares/error.middleware');

const app = express();
const isTest = process.env.NODE_ENV === 'test';

app.set('trust proxy', 1);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'https://cdn.jsdelivr.net'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: null,
      },
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // lets Live Server pages show /uploads images
  })
);

const allowedOrigins = (process.env.CLIENT_URL || '').split(',').map((s) => s.trim()).filter(Boolean);
app.use(cors({ origin: (origin, cb) => cb(null, !origin || allowedOrigins.includes(origin)) }));

app.use(express.json({ limit: '10kb' }));
app.use(mongoSanitize());
if (!isTest) app.use(morgan('dev'));

if (!isTest) {
  app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, message: { success: false, message: 'Too many requests, try again later' } }));
  app.use('/api/v1/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, message: { success: false, message: 'Too many login attempts, try again later' } }));
  app.use('/api/v1/auth/register', rateLimit({ windowMs: 60 * 60 * 1000, limit: 20, message: { success: false, message: 'Too many sign-ups, try again later' } }));
}

app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/v1', routes);

// the backend also serves the frontend, so http://localhost:5000 works without Live Server
app.use(express.static(path.join(__dirname, '..', '..', 'frontend')));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
