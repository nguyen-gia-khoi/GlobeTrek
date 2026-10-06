const classifySession = (cookies = {}, area) => {
  const hasAdmin = Boolean(cookies.AdminaccessToken);
  const hasPartner = Boolean(cookies.PartneraccessToken);

  if (hasAdmin && hasPartner) {
    return { ok: false, status: 401, reason: 'conflict' };
  }

  if (area === 'admin') {
    if (!hasAdmin && hasPartner) return { ok: false, status: 403, reason: 'wrong-role' };
    if (!hasAdmin) return { ok: false, status: 401, reason: 'missing' };
    return { ok: true, cookie: 'AdminaccessToken' };
  }

  if (area === 'partner') {
    if (!hasPartner && hasAdmin) return { ok: false, status: 403, reason: 'wrong-role' };
    if (!hasPartner) return { ok: false, status: 401, reason: 'missing' };
    return { ok: true, cookie: 'PartneraccessToken' };
  }

  return { ok: false, status: 401, reason: 'missing' };
};

const accountAllowed = (user, area) => {
  if (!user) return { ok: false, status: 401, reason: 'missing' };
  if (user.UserStatus === 'ban') return { ok: false, status: 403, reason: 'banned' };

  if (area === 'admin') {
    return user.role === 'admin'
      ? { ok: true }
      : { ok: false, status: 403, reason: 'wrong-role' };
  }

  if (area === 'partner') {
    if (user.role !== 'partner') return { ok: false, status: 403, reason: 'wrong-role' };
    if (user.status !== 'verified') return { ok: false, status: 403, reason: 'unverified' };
    return { ok: true };
  }

  return { ok: true };
};

module.exports = { classifySession, accountAllowed };
