const cookieBase = (maxAge) => ({
  httpOnly: true,
  sameSite: 'strict',
  secure: process.env.COOKIE_SECURE === 'true',
  path: '/',
  ...(maxAge ? { maxAge } : {}),
});

const clearCookie = (res, name) => {
  res.clearCookie(name, cookieBase());
};

const clearAuthCookies = (res) => {
  ['AdminaccessToken', 'PartneraccessToken', 'refreshToken', 'oauth_state'].forEach((name) => {
    clearCookie(res, name);
  });
};

const clearOppositePortalCookie = (res, area) => {
  clearCookie(res, area === 'admin' ? 'PartneraccessToken' : 'AdminaccessToken');
};

const setPortalCookie = (res, area, token, maxAge) => {
  const name = area === 'admin' ? 'AdminaccessToken' : 'PartneraccessToken';
  clearOppositePortalCookie(res, area);
  res.cookie(name, token, cookieBase(maxAge));
};

const setRefreshCookie = (res, token, maxAge) => {
  res.cookie('refreshToken', token, cookieBase(maxAge));
};

const setOAuthStateCookie = (res, state) => {
  res.cookie('oauth_state', state, {
    ...cookieBase(10 * 60 * 1000),
    sameSite: 'lax',
  });
};

module.exports = {
  cookieBase,
  clearCookie,
  clearAuthCookies,
  clearOppositePortalCookie,
  setPortalCookie,
  setRefreshCookie,
  setOAuthStateCookie,
};
