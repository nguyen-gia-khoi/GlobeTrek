const crypto = require('crypto');
const redis = require('../../config/redis');

const MAX_AGE_MS = 5 * 60 * 1000;

const safeEqual = (left, right) => {
  const leftBuffer = Buffer.from(String(left || ''));
  const rightBuffer = Buffer.from(String(right || ''));
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

const verifyWebhook = async (req, res, next) => {
  try {
    const secret = process.env.WEBHOOK_SECRET;
    if (!secret) return res.status(503).json({ message: 'Webhook chưa được cấu hình' });

    const timestamp = req.get('x-globetrek-timestamp');
    const signature = req.get('x-globetrek-signature');
    const age = Math.abs(Date.now() - Number(timestamp));
    if (!timestamp || !signature || !Number.isFinite(age) || age > MAX_AGE_MS) {
      return res.status(401).json({ message: 'Chữ ký webhook không hợp lệ' });
    }

    const payload = `${timestamp}.${req.rawBody ? req.rawBody.toString() : ''}`;
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    if (!safeEqual(signature, expected)) {
      return res.status(401).json({ message: 'Chữ ký webhook không hợp lệ' });
    }

    const replayKey = `webhook:replay:${expected}`;
    const stored = await redis.set(replayKey, '1', 'EX', 10 * 60, 'NX');
    if (stored !== 'OK') return res.status(409).json({ message: 'Webhook đã được xử lý' });
    return next();
  } catch (error) {
    console.error('Webhook verification error:', error.message);
    return res.status(401).json({ message: 'Chữ ký webhook không hợp lệ' });
  }
};

module.exports = { verifyWebhook, safeEqual };
