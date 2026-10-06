const crypto = require('crypto');

const CSRF_COOKIE = 'gt_csrf';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const csrfCookieOptions = () => ({
  httpOnly: false,
  sameSite: 'strict',
  secure: process.env.COOKIE_SECURE === 'true',
  path: '/',
  maxAge: 8 * 60 * 60 * 1000,
});

const hasPortalSession = (req) => Boolean(
  req.cookies?.AdminaccessToken || req.cookies?.PartneraccessToken || req.cookies?.refreshToken
);

const issueCsrf = (req, res, next) => {
  let token = req.cookies?.[CSRF_COOKIE];
  if (!token) {
    token = crypto.randomBytes(32).toString('hex');
    res.cookie(CSRF_COOKIE, token, csrfCookieOptions());
  }
  res.locals.csrfToken = token;
  next();
};

const verifyCsrf = (req, res, next) => {
  if (SAFE_METHODS.has(req.method)) return next();
  const bearer = req.headers.authorization && req.headers.authorization.startsWith('Bearer ');
  if (bearer || !hasPortalSession(req)) return next();
  if (req.path === '/orders/api/whrefund' || req.path === '/orders/handelEvent') return next();

  const cookieToken = req.cookies?.[CSRF_COOKIE];
  const provided = req.get('x-csrf-token') || req.body?._csrf || req.query?._csrf;
  if (!cookieToken || !provided || cookieToken !== provided) {
    if (req.headers.accept && req.headers.accept.includes('application/json')) {
      return res.status(403).json({ message: 'CSRF token không hợp lệ' });
    }
    return res.status(403).send('CSRF token không hợp lệ');
  }
  return next();
};

module.exports = { CSRF_COOKIE, issueCsrf, verifyCsrf };
