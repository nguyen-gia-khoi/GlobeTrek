const helmet = require('helmet');

const useHttps = process.env.COOKIE_SECURE === 'true';

const securityHeaders = helmet({
  crossOriginEmbedderPolicy: false,
  strictTransportSecurity: useHttps,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  contentSecurityPolicy: {
    directives: {
      upgradeInsecureRequests: useHttps ? [] : null,
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      objectSrc: ["'none'"],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net', 'https://cdnjs.cloudflare.com', 'https://cdn.sheetjs.com'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net', 'https://cdnjs.cloudflare.com', 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'https://cdnjs.cloudflare.com', 'data:'],
      imgSrc: ["'self'", 'data:', 'blob:', 'https:', process.env.MINIO_PUBLIC_URL].filter(Boolean),
      connectSrc: ["'self'", 'https://cdn.jsdelivr.net', 'https://cdn.sheetjs.com'],
    },
  },
});

module.exports = { securityHeaders };
