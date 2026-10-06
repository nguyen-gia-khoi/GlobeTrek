const rateLimit = require('express-rate-limit');

const buildLimiter = (limit, message) => rateLimit({
  windowMs: 15 * 60 * 1000,
  limit,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message },
});

const authLimiter = buildLimiter(10, 'Quá nhiều lần đăng nhập. Vui lòng thử lại sau.');
const sensitiveLimiter = buildLimiter(5, 'Quá nhiều yêu cầu. Vui lòng thử lại sau.');
const webhookLimiter = buildLimiter(60, 'Quá nhiều webhook. Vui lòng thử lại sau.');

module.exports = { authLimiter, sensitiveLimiter, webhookLimiter };
