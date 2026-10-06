const allowedOrigins = () => {
  const configured = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin && origin !== '*');
  const defaults = [process.env.FRONTEND_URL, process.env.CLIENT_URL, process.env.VITE_REDIRECT_URL]
    .filter((origin) => origin && origin !== '*');
  const origins = [...new Set([...configured, ...defaults])];

  if (process.env.NODE_ENV !== 'production') {
    origins.push('http://localhost:5173', 'http://127.0.0.1:5173');
  }

  return [...new Set(origins)];
};

const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    const origins = allowedOrigins();
    if (origins.includes(origin)) return callback(null, true);
    return callback(new Error('Origin không được phép'));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-csrf-token', 'x-globetrek-signature', 'x-globetrek-timestamp'],
  credentials: true,
};

const cors = require('cors');

const corsMiddleware = (req, res, next) => cors({
  ...corsOptions,
  origin(origin, callback) {
    const host = req.get('host');
    if (!origin || (host && origin === `${req.protocol}://${host}`)) {
      return callback(null, true);
    }
    return corsOptions.origin(origin, callback);
  },
})(req, res, next);

module.exports = { allowedOrigins, corsOptions, corsMiddleware };
