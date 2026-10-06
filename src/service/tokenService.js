const redis = require("../config/redis");
const jwt = require("jsonwebtoken");

const PORTAL_ACCESS_TTL_SECONDS = 60 * 60 * 8;
const SPA_ACCESS_TTL_SECONDS = 15 * 60;
const REFRESH_TTL_SECONDS = 60 * 60 * 24 * 7;

const generateToken = (userId, options = {}) => {
  const accessTtl = options.accessTtlSeconds || SPA_ACCESS_TTL_SECONDS;
  const accessToken = jwt.sign({ userId }, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: accessTtl,
  });
  const refreshToken = jwt.sign({ userId }, process.env.REFRESH_TOKEN_SECRET, {
    expiresIn: REFRESH_TTL_SECONDS,
  });
  return { accessToken, refreshToken };
};

const storeRefreshToken = async (userId, refreshToken) => {
  await redis.set(
    `refresh_token:${userId}`,
    refreshToken,
    "EX",
    60 * 60 * 24 * 7
  );
};

const storeAccessToken = async (userId, accessToken, ttlSeconds = 60 * 60 * 24) => {
  await redis.set(
    `access_token:${userId}`,
    accessToken,
    "EX",
    ttlSeconds
  );
};

const removeAccessToken = async (userId) => {
  await redis.del(`access_token:${userId}`);
};

const revokeUserTokens = async (userId) => {
  await redis.del(`access_token:${userId}`);
  await redis.del(`refresh_token:${userId}`);
};

module.exports = {
  PORTAL_ACCESS_TTL_SECONDS,
  SPA_ACCESS_TTL_SECONDS,
  REFRESH_TTL_SECONDS,
  generateToken,
  storeRefreshToken,
  storeAccessToken,
  removeAccessToken,
  revokeUserTokens,
};
