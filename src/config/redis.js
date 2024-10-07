const Redis = require("ioredis");
const dotenv = require("dotenv");

dotenv.config();

const redis = new Redis(process.env.UPSTASH_REDIS_URL);
module.exports = redis;
