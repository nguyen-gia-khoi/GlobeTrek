const jwt = require('jsonwebtoken');
const User = require('../models/User');
const redis = require('../config/redis');
const { classifySession, accountAllowed } = require('./authPolicy');
const { clearAuthCookies } = require('./security/cookies');

const wantsJson = (req) => Boolean(
  req.xhr
  || (req.headers.accept && req.headers.accept.includes('application/json') && !req.headers.accept.includes('text/html'))
);

const deny = (req, res, status, message, clear = false) => {
  if (clear) clearAuthCookies(res);
  if (wantsJson(req)) return res.status(status).json({ message });
  return res.redirect('/api/auth/login');
};

const createAuthMiddleware = ({ verifyJwt, readStoredToken, findUser, revoke }) => {
  const resolveUser = async (token) => {
    let decoded;
    try {
      decoded = verifyJwt(token);
    } catch (error) {
      const invalid = new Error('Token is not valid or expired');
      invalid.status = 403;
      throw invalid;
    }

    const stored = await readStoredToken(decoded.userId);
    if (!stored || stored !== token) {
      const invalid = new Error('Access token is invalid, expired, or logged out');
      invalid.status = 401;
      throw invalid;
    }

    const user = await findUser(decoded.userId);
    if (!user) {
      const missing = new Error('User not found');
      missing.status = 401;
      throw missing;
    }
    return user;
  };

  const authenticate = (area) => async function authenticateRequest(req, res, next) {
    try {
      if (area === 'bearer') {
        const header = req.headers.authorization || '';
        const token = header.startsWith('Bearer ') ? header.slice(7) : null;
        if (!token) return deny(req, res, 401, 'No token provided');
        const user = await resolveUser(token);
        const decision = accountAllowed(user, 'bearer');
        if (!decision.ok) {
          if (decision.reason === 'banned') await revoke(user._id);
          return deny(req, res, decision.status, 'Access denied', decision.reason === 'banned');
        }
        req.user = user;
        req.authArea = 'bearer';
        return next();
      }

      const session = classifySession(req.cookies || {}, area);
      if (!session.ok) {
        const message = session.reason === 'conflict'
          ? 'Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.'
          : 'Access denied';
        return deny(req, res, session.status, message, session.reason === 'conflict');
      }

      const user = await resolveUser(req.cookies[session.cookie]);
      const decision = accountAllowed(user, area);
      if (!decision.ok) {
        if (decision.reason === 'banned' || decision.reason === 'unverified') await revoke(user._id);
        return deny(req, res, decision.status, 'Access denied', true);
      }

      req.user = user;
      req.authArea = area;
      return next();
    } catch (error) {
      return deny(req, res, error.status || 403, error.message || 'Access denied', error.status === 401);
    }
  };

  const verifyToken = authenticate('bearer');
  const requireAdmin = authenticate('admin');
  const requireVerifiedPartner = authenticate('partner');

  return { verifyToken, requireAdmin, requireVerifiedPartner };
};

const middleware = createAuthMiddleware({
  verifyJwt: (token) => jwt.verify(token, process.env.ACCESS_TOKEN_SECRET),
  readStoredToken: (userId) => redis.get(`access_token:${userId}`),
  findUser: (userId) => User.findById(userId).select('-password'),
  revoke: async (userId) => {
    await redis.del(`access_token:${userId}`);
    await redis.del(`refresh_token:${userId}`);
  },
});

module.exports = {
  ...middleware,
  createAuthMiddleware,
  wantsJson,
};
