const Redis = require("ioredis");
const dotenv = require("dotenv");

dotenv.config();

const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";
const redis = new Redis(redisUrl);

redis.on("connect", () => {
  console.log("Connected to Redis");
});

redis.on("error", (err) => {
  console.error("Redis connection error:", err.message);
});

module.exports = redis;
