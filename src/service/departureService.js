const mongoose = require('mongoose');
const moment = require('moment-timezone');
const TourDeparture = require('../models/TourDeparture');
const Order = require('../models/Order');
const { releasePromotionUse } = require('./promotionService');

const VN_TZ = 'Asia/Ho_Chi_Minh';

const sessionOption = (session) => (session ? { session } : {});

const dayBounds = (value) => ({
  start: moment.tz(value, VN_TZ).startOf('day').toDate(),
  end: moment.tz(value, VN_TZ).endOf('day').toDate(),
});

const departureSlotsByTour = async (tourIds, { openOnly = false, upcomingOnly = false } = {}) => {
  const ids = tourIds.filter(Boolean);
  if (!ids.length) return new Map();

  const filter = { tour: { $in: ids } };
  if (openOnly) filter.status = 'open';
  if (upcomingOnly) filter.departureDate = { $gte: moment.tz(VN_TZ).startOf('day').toDate() };

  const rows = await TourDeparture.find(filter).sort({ departureDate: 1 }).lean();
  return rows.reduce((map, row) => {
    const key = String(row.tour);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push({
      id: row._id,
      departureId: row._id,
      date: row.departureDate,
      capacity: row.capacity,
      heldSeats: row.heldSeats,
      soldSeats: row.soldSeats,
      status: row.status,
      availableSeats: Math.max(0, row.capacity - row.heldSeats - row.soldSeats),
    });
    return map;
  }, new Map());
};

const attachDepartures = async (tourDocs, options) => {
  const docs = (Array.isArray(tourDocs) ? tourDocs : [tourDocs]).filter(Boolean);
  const slots = await departureSlotsByTour(docs.map((tour) => tour._id), options);
  const payload = docs.map((tour) => {
    const value = typeof tour.toObject === 'function' ? tour.toObject() : { ...tour };
    value.departures = slots.get(String(tour._id)) || [];
    return value;
  });
  return Array.isArray(tourDocs) ? payload : payload[0];
};

const isTransactionUnsupported = (error) => (
  error?.code === 20
  || /Transaction numbers are only allowed|replica set member|mongos/i.test(error?.message || '')
);

const runWithOptionalTransaction = async (work) => {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } catch (error) {
    if (!isTransactionUnsupported(error)) throw error;
    return work(null);
  } finally {
    await session.endSession();
  }
};

const resolveDeparture = async ({ tourId, departureId, bookingDate, requireOpen = true }) => {
  const filter = { tour: tourId };
  if (departureId && mongoose.Types.ObjectId.isValid(departureId)) {
    filter._id = departureId;
  } else {
    const { start, end } = dayBounds(bookingDate);
    filter.departureDate = { $gte: start, $lte: end };
  }
  if (requireOpen) filter.status = 'open';
  return TourDeparture.findOne(filter);
};

const reserveSeats = async (departureId, seats, session = null) => TourDeparture.findOneAndUpdate(
  {
    _id: departureId,
    status: 'open',
    $expr: {
      $gte: [
        { $subtract: ['$capacity', { $add: ['$heldSeats', '$soldSeats'] }] },
        seats,
      ],
    },
  },
  { $inc: { heldSeats: seats } },
  { new: true, ...sessionOption(session) }
);

const undoReservation = async (departureId, seats, session = null) => TourDeparture.findOneAndUpdate(
  { _id: departureId, heldSeats: { $gte: seats } },
  { $inc: { heldSeats: -seats } },
  { new: true, ...sessionOption(session) }
);

const ensureOrderDeparture = async (order, session = null) => {
  if (order.departure) return order.departure;
  const departure = await resolveDeparture({
    tourId: order.tour,
    bookingDate: order.bookingDate,
    requireOpen: false,
  });
  if (!departure) throw new Error('Không tìm thấy lịch khởi hành của đơn hàng');
  order.departure = departure._id;
  await order.save(sessionOption(session));
  return departure._id;
};

const confirmHeldOrder = async (orderId) => runWithOptionalTransaction(async (session) => {
  const current = await Order.findById(orderId).session(session);
  if (!current) throw new Error('Order not found');
  if (current.status === 'paid' && current.seatState === 'sold') return current;
  if (!['pending', 'processing'].includes(current.status) || current.seatState !== 'held') {
    throw new Error('Đơn hàng không còn ở trạng thái chờ thanh toán');
  }

  const departureId = await ensureOrderDeparture(current, session);
  const seats = (current.adultCount || 0) + (current.childCount || 0);
  const updatedOrder = await Order.findOneAndUpdate(
    { _id: orderId, status: { $in: ['pending', 'processing'] }, seatState: 'held' },
    { $set: { status: 'paid', seatState: 'sold' } },
    { new: true, ...sessionOption(session) }
  );
  if (!updatedOrder) throw new Error('Đơn hàng đã được xử lý');

  const departure = await TourDeparture.findOneAndUpdate(
    { _id: departureId, heldSeats: { $gte: seats } },
    { $inc: { heldSeats: -seats, soldSeats: seats } },
    { new: true, ...sessionOption(session) }
  );
  if (!departure) {
    if (!session) {
      await Order.updateOne(
        { _id: orderId, status: 'paid', seatState: 'sold' },
        { $set: { status: current.status, seatState: 'held' } }
      );
    }
    throw new Error('Dữ liệu chỗ giữ không hợp lệ');
  }
  return updatedOrder;
});

const releaseHeldOrder = async (orderId) => runWithOptionalTransaction(async (session) => {
  const current = await Order.findById(orderId).session(session);
  if (!current) return null;
  if (current.status === 'canceled' || current.seatState === 'released') return current;
  if (!['pending', 'processing'].includes(current.status) || current.seatState !== 'held') return current;

  const departureId = await ensureOrderDeparture(current, session);
  const seats = (current.adultCount || 0) + (current.childCount || 0);
  const updatedOrder = await Order.findOneAndUpdate(
    { _id: orderId, status: { $in: ['pending', 'processing'] }, seatState: 'held' },
    { $set: { status: 'canceled', seatState: 'released' } },
    { new: true, ...sessionOption(session) }
  );
  if (!updatedOrder) return Order.findById(orderId).session(session);

  const departure = await TourDeparture.findOneAndUpdate(
    { _id: departureId, heldSeats: { $gte: seats } },
    { $inc: { heldSeats: -seats } },
    { new: true, ...sessionOption(session) }
  );
  if (!departure) {
    if (!session) {
      await Order.updateOne(
        { _id: orderId, status: 'canceled', seatState: 'released' },
        { $set: { status: current.status, seatState: 'held' } }
      );
    }
    throw new Error('Dữ liệu chỗ giữ không hợp lệ');
  }
  if (updatedOrder.promotion) await releasePromotionUse(updatedOrder.promotion, session);
  return updatedOrder;
});

const releaseSoldOrder = async (orderId) => runWithOptionalTransaction(async (session) => {
  const current = await Order.findById(orderId).session(session);
  if (!current) return null;
  if (current.status === 'canceled' || current.seatState === 'released') return current;
  if (current.status !== 'paid' || current.seatState !== 'sold') {
    throw new Error('Chỉ có thể hoàn chỗ cho đơn đã thanh toán');
  }

  const departureId = await ensureOrderDeparture(current, session);
  const seats = (current.adultCount || 0) + (current.childCount || 0);
  const updatedOrder = await Order.findOneAndUpdate(
    { _id: orderId, status: 'paid', seatState: 'sold' },
    { $set: { status: 'canceled', seatState: 'released' } },
    { new: true, ...sessionOption(session) }
  );
  if (!updatedOrder) return Order.findById(orderId).session(session);

  const departure = await TourDeparture.findOneAndUpdate(
    { _id: departureId, soldSeats: { $gte: seats } },
    { $inc: { soldSeats: -seats } },
    { new: true, ...sessionOption(session) }
  );
  if (!departure) {
    if (!session) {
      await Order.updateOne(
        { _id: orderId, status: 'canceled', seatState: 'released' },
        { $set: { status: 'paid', seatState: 'sold' } }
      );
    }
    throw new Error('Dữ liệu chỗ đã bán không hợp lệ');
  }
  return updatedOrder;
});

module.exports = {
  dayBounds,
  departureSlotsByTour,
  attachDepartures,
  runWithOptionalTransaction,
  resolveDeparture,
  reserveSeats,
  undoReservation,
  confirmHeldOrder,
  releaseHeldOrder,
  releaseSoldOrder,
};
