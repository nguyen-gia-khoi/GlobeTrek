const helmet = require('helmet');

const isProduction = process.env.NODE_ENV === 'production';

const securityHeaders = helmet({
  crossOriginEmbedderPolicy: false,
  strictTransportSecurity: isProduction,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  contentSecurityPolicy: {
    directives: {
      upgradeInsecureRequests: isProduction ? [] : null,
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      objectSrc: ["'none'"],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net', 'https://cdnjs.cloudflare.com', 'https://cdn.sheetjs.com'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net', 'https://cdnjs.cloudflare.com', 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'https://cdnjs.cloudflare.com', 'data:'],
      imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
      connectSrc: ["'self'", 'https://cdn.jsdelivr.net', 'https://cdn.sheetjs.com'],
    },
  },
});

module.exports = { securityHeaders };
