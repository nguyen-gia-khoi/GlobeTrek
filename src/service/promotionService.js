const moment = require('moment-timezone');
const Promotion = require('../models/Promotion');
const Order = require('../models/Order');

const VN_TZ = 'Asia/Ho_Chi_Minh';

class PromotionError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const money = (value) => Math.round(Number(value) || 0);

const sessionOption = (session) => (session ? { session } : {});

const publishedPrices = (tour) => {
  const adult = money(tour.price);
  const holidayAdult = tour.specialAdultPrice > 0
    ? money(tour.specialAdultPrice)
    : money(tour.price * (tour.holidayAdultPercent ?? 150) / 100);
  const childBase = tour.childPrice > 0
    ? money(tour.childPrice)
    : money(tour.price * (tour.childPercent ?? 75) / 100);
  const holidayChild = tour.specialChildPrice > 0
    ? money(tour.specialChildPrice)
    : money(childBase * (tour.holidayChildPercent ?? 150) / 100);
  return {
    adult: [...new Set([adult, holidayAdult])],
    child: [...new Set([childBase, holidayChild])],
  };
};

const resolveUnit = (sent, allowed, label) => {
  if (sent === undefined || sent === null || sent === '') return allowed[0];
  const value = money(sent);
  if (!allowed.includes(value)) {
    throw new PromotionError(`${label} không khớp giá công bố của tour`);
  }
  return value;
};

const discountFor = (promotion, subtotal) => {
  if (promotion.discountType === 'percent') {
    return Math.min(subtotal, money(subtotal * promotion.discountValue / 100));
  }
  return Math.min(subtotal, money(promotion.discountValue));
};

const coversTour = (promotion, tourId) => {
  if (!promotion.tourIds?.length) return true;
  return promotion.tourIds.some((id) => String(id) === String(tourId));
};

const withinRange = (value, start, end) => {
  const time = new Date(value).getTime();
  if (start && time < new Date(start).getTime()) return false;
  if (end && time > new Date(end).getTime()) return false;
  return true;
};

const rejectionReason = (promotion, { tour, departure, subtotal, userUses }) => {
  if (!promotion || promotion.status !== 'active') return 'Mã giảm giá không còn hiệu lực';
  if (!coversTour(promotion, tour._id)) return 'Mã không áp dụng cho tour này';
  if (!withinRange(new Date(), promotion.bookingStart, promotion.bookingEnd)) {
    return 'Mã không nằm trong thời gian đặt';
  }
  if ((promotion.departureStart || promotion.departureEnd)
    && !withinRange(departure.departureDate, promotion.departureStart, promotion.departureEnd)) {
    return 'Mã không áp dụng cho ngày khởi hành này';
  }
  if (subtotal < (promotion.minSubtotal || 0)) return 'Đơn chưa đạt giá trị tối thiểu của mã';
  if (promotion.usageLimit != null && promotion.usedCount >= promotion.usageLimit) {
    return 'Mã đã hết lượt sử dụng';
  }
  if (promotion.perUserLimit != null && userUses >= promotion.perUserLimit) {
    return 'Bạn đã dùng hết lượt của mã này';
  }
  return '';
};

const userUseCount = async (userId, promotionId) => {
  if (!userId || !promotionId) return 0;
  return Order.countDocuments({
    user: userId,
    promotion: promotionId,
    status: { $in: ['pending', 'processing', 'paid'] },
  });
};

const summarize = (promotion, amount) => (promotion ? {
  id: promotion._id,
  name: promotion.name,
  kind: promotion.kind,
  code: promotion.code || '',
  discountType: promotion.discountType,
  discountValue: promotion.discountValue,
  discountAmount: amount,
} : null);

const quoteOrder = async ({
  tour,
  departure,
  adultCount = 0,
  childCount = 0,
  adultPrice,
  childPrice,
  code,
  userId,
}) => {
  if (!tour || tour.isDeleted) throw new PromotionError('Không tìm thấy tour');
  if (!departure) throw new PromotionError('Không tìm thấy lịch khởi hành');

  const adults = Math.max(0, Number(adultCount) || 0);
  const children = Math.max(0, Number(childCount) || 0);
  if (adults + children <= 0) throw new PromotionError('Cần ít nhất một hành khách');

  const prices = publishedPrices(tour);
  const adultUnit = adults > 0 ? resolveUnit(adultPrice, prices.adult, 'Giá người lớn') : 0;
  const childUnit = children > 0 ? resolveUnit(childPrice, prices.child, 'Giá trẻ em') : 0;
  const originalTotal = money(adultUnit * adults + childUnit * children);

  const normalizedCode = String(code || '').trim().toUpperCase();
  const candidates = await Promotion.find({
    partner: tour.partner,
    status: 'active',
    kind: normalizedCode ? 'code' : 'automatic',
    ...(normalizedCode ? { code: normalizedCode } : {}),
  }).lean();

  let selected = null;
  let discountAmount = 0;

  if (normalizedCode) {
    const promotion = candidates[0];
    if (!promotion) throw new PromotionError('Mã giảm giá không tồn tại');
    const uses = await userUseCount(userId, promotion._id);
    const reason = rejectionReason(promotion, { tour, departure, subtotal: originalTotal, userUses: uses });
    if (reason) throw new PromotionError(reason);
    selected = promotion;
    discountAmount = discountFor(promotion, originalTotal);
  } else {
    const ranked = [];
    for (const promotion of candidates) {
      const uses = await userUseCount(userId, promotion._id);
      if (rejectionReason(promotion, { tour, departure, subtotal: originalTotal, userUses: uses })) continue;
      ranked.push({ promotion, amount: discountFor(promotion, originalTotal) });
    }
    ranked.sort((a, b) => b.amount - a.amount || b.promotion.discountValue - a.promotion.discountValue);
    if (ranked[0]?.amount > 0) {
      selected = ranked[0].promotion;
      discountAmount = ranked[0].amount;
    }
  }

  return {
    adultPrice: adultUnit,
    childPrice: childUnit,
    originalTotal,
    discountAmount,
    totalValue: originalTotal - discountAmount,
    promotion: summarize(selected, discountAmount),
  };
};

const reservePromotionUse = async (promotionId, userId, session = null) => {
  if (!promotionId) return null;
  const promotion = await Promotion.findById(promotionId).session(session);
  if (!promotion || promotion.status !== 'active') {
    throw new PromotionError('Ưu đãi không còn hiệu lực');
  }
  if (promotion.perUserLimit != null) {
    const uses = await Order.countDocuments({
      user: userId,
      promotion: promotionId,
      status: { $in: ['pending', 'processing', 'paid'] },
    }).session(session);
    if (uses >= promotion.perUserLimit) {
      throw new PromotionError('Bạn đã dùng hết lượt của ưu đãi này');
    }
  }

  const updated = await Promotion.findOneAndUpdate(
    {
      _id: promotionId,
      status: 'active',
      $expr: {
        $lt: ['$usedCount', { $ifNull: ['$usageLimit', Number.MAX_SAFE_INTEGER] }],
      },
    },
    { $inc: { usedCount: 1 } },
    { new: true, ...sessionOption(session) }
  );
  if (!updated) throw new PromotionError('Ưu đãi đã hết lượt sử dụng');
  return updated;
};

const releasePromotionUse = async (promotionId, session = null) => {
  if (!promotionId) return null;
  return Promotion.findOneAndUpdate(
    { _id: promotionId, usedCount: { $gte: 1 } },
    { $inc: { usedCount: -1 } },
    { new: true, ...sessionOption(session) }
  );
};

const startOfDay = (value) => {
  if (!value) return null;
  const parsed = moment.tz(String(value), 'YYYY-MM-DD', true, VN_TZ);
  if (!parsed.isValid()) return undefined;
  return parsed.startOf('day').toDate();
};

const endOfDay = (value) => {
  if (!value) return null;
  const parsed = moment.tz(String(value), 'YYYY-MM-DD', true, VN_TZ);
  if (!parsed.isValid()) return undefined;
  return parsed.endOf('day').toDate();
};

module.exports = {
  PromotionError,
  quoteOrder,
  reservePromotionUse,
  releasePromotionUse,
  startOfDay,
  endOfDay,
};
