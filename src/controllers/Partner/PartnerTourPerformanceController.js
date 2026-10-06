const moment = require('moment-timezone');
const Order = require('../../models/Order');
const TourDeparture = require('../../models/TourDeparture');
const { Tour } = require('../../models/Tour');

const VN_TZ = 'Asia/Ho_Chi_Minh';
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const percent = (value, total) => (total > 0 ? (value / total) * 100 : 0);
const round = (value, precision = 1) => {
  const factor = 10 ** precision;
  return Math.round((Number(value) || 0) * factor) / factor;
};

const comparison = (current, previous) => ({
  current: round(current, 2),
  previous: round(previous, 2),
  change: previous > 0 ? round(((current - previous) / previous) * 100, 1) : (current > 0 ? null : 0),
});

const normalizeFilters = (query = {}) => {
  const now = moment().tz(VN_TZ);
  const defaultFrom = now.clone().startOf('month').format('YYYY-MM-DD');
  const defaultTo = now.clone().endOf('month').format('YYYY-MM-DD');
  const fromDate = DATE_PATTERN.test(query.fromDate || '') ? query.fromDate : defaultFrom;
  const toDate = DATE_PATTERN.test(query.toDate || '') ? query.toDate : defaultTo;

  return {
    fromDate,
    toDate,
    tourId: String(query.tourId || '').trim(),
  };
};

const periodFromFilters = (filters) => {
  const start = moment.tz(filters.fromDate, VN_TZ).startOf('day');
  const end = moment.tz(filters.toDate, VN_TZ).endOf('day');
  if (!start.isValid() || !end.isValid() || start.isAfter(end)) {
    return null;
  }

  const dayCount = end.clone().startOf('day').diff(start.clone().startOf('day'), 'days') + 1;
  if (dayCount > 366) {
    return null;
  }
  const previousEnd = start.clone().subtract(1, 'day').endOf('day');
  const previousStart = previousEnd.clone().subtract(dayCount - 1, 'days').startOf('day');

  return {
    start: start.toDate(),
    end: end.toDate(),
    previousStart: previousStart.toDate(),
    previousEnd: previousEnd.toDate(),
    dayCount,
  };
};

const aggregateOrders = async (tourIds, start, end, includeDaily = false) => {
  const groupId = includeDaily
    ? {
      tour: '$tour',
      date: { $dateToString: { date: '$bookingDate', format: '%Y-%m-%d', timezone: VN_TZ } },
    }
    : '$tour';

  return Order.aggregate([
    {
      $match: {
        tour: { $in: tourIds },
        bookingDate: { $gte: start, $lte: end },
      },
    },
    {
      $group: {
        _id: groupId,
        revenue: {
          $sum: { $cond: [{ $eq: ['$status', 'paid'] }, '$totalValue', 0] },
        },
        paidOrders: {
          $sum: { $cond: [{ $eq: ['$status', 'paid'] }, 1, 0] },
        },
        guests: {
          $sum: {
            $cond: [
              { $eq: ['$status', 'paid'] },
              { $add: ['$adultCount', '$childCount'] },
              0,
            ],
          },
        },
        canceledOrders: {
          $sum: { $cond: [{ $eq: ['$status', 'canceled'] }, 1, 0] },
        },
      },
    },
  ]);
};

const aggregateDepartures = async (tourIds, start, end, includeDaily = false) => {
  const groupId = includeDaily
    ? {
      tour: '$tour',
      date: { $dateToString: { date: '$departureDate', format: '%Y-%m-%d', timezone: VN_TZ } },
    }
    : '$tour';

  return TourDeparture.aggregate([
    {
      $match: {
        tour: { $in: tourIds },
        departureDate: { $gte: start, $lte: end },
        status: { $ne: 'canceled' },
      },
    },
    {
      $group: {
        _id: groupId,
        capacity: { $sum: '$capacity' },
        soldSeats: { $sum: '$soldSeats' },
        heldSeats: { $sum: '$heldSeats' },
        departures: { $sum: 1 },
      },
    },
  ]);
};

const keyedByTour = (rows) => rows.reduce((map, row) => {
  map.set(String(row._id), row);
  return map;
}, new Map());

const periodSummary = (tours, orderRows, departureRows) => {
  const ordersByTour = keyedByTour(orderRows);
  const departuresByTour = keyedByTour(departureRows);

  const rows = tours.map((tour) => {
    const order = ordersByTour.get(String(tour._id)) || {};
    const departure = departuresByTour.get(String(tour._id)) || {};
    const paidOrders = Number(order.paidOrders) || 0;
    const canceledOrders = Number(order.canceledOrders) || 0;
    const capacity = Number(departure.capacity) || 0;
    const soldSeats = Number(departure.soldSeats) || 0;

    return {
      tourId: String(tour._id),
      tourName: tour.title,
      revenue: Number(order.revenue) || 0,
      paidOrders,
      guests: Number(order.guests) || 0,
      canceledOrders,
      cancellationRate: round(percent(canceledOrders, paidOrders + canceledOrders)),
      capacity,
      soldSeats,
      heldSeats: Number(departure.heldSeats) || 0,
      departures: Number(departure.departures) || 0,
      occupancyRate: round(percent(soldSeats, capacity)),
    };
  });

  const totals = rows.reduce((result, row) => ({
    revenue: result.revenue + row.revenue,
    paidOrders: result.paidOrders + row.paidOrders,
    guests: result.guests + row.guests,
    canceledOrders: result.canceledOrders + row.canceledOrders,
    capacity: result.capacity + row.capacity,
    soldSeats: result.soldSeats + row.soldSeats,
    heldSeats: result.heldSeats + row.heldSeats,
    departures: result.departures + row.departures,
  }), {
    revenue: 0,
    paidOrders: 0,
    guests: 0,
    canceledOrders: 0,
    capacity: 0,
    soldSeats: 0,
    heldSeats: 0,
    departures: 0,
  });

  totals.occupancyRate = round(percent(totals.soldSeats, totals.capacity));
  totals.cancellationRate = round(
    percent(totals.canceledOrders, totals.paidOrders + totals.canceledOrders)
  );

  return { rows, totals };
};

const buildTrend = (period, orderRows, departureRows) => {
  const values = new Map();
  const ensure = (date) => {
    if (!values.has(date)) {
      values.set(date, {
        date,
        label: moment.tz(date, VN_TZ).format('DD/MM'),
        revenue: 0,
        paidOrders: 0,
        guests: 0,
        capacity: 0,
        soldSeats: 0,
        occupancyRate: 0,
      });
    }
    return values.get(date);
  };

  for (let cursor = moment(period.start).tz(VN_TZ).startOf('day');
    cursor.isSameOrBefore(moment(period.end).tz(VN_TZ), 'day');
    cursor.add(1, 'day')) {
    ensure(cursor.format('YYYY-MM-DD'));
  }

  orderRows.forEach((row) => {
    const point = ensure(row._id.date);
    point.revenue += Number(row.revenue) || 0;
    point.paidOrders += Number(row.paidOrders) || 0;
    point.guests += Number(row.guests) || 0;
  });

  departureRows.forEach((row) => {
    const point = ensure(row._id.date);
    point.capacity += Number(row.capacity) || 0;
    point.soldSeats += Number(row.soldSeats) || 0;
  });

  return [...values.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((point) => ({
      ...point,
      occupancyRate: round(percent(point.soldSeats, point.capacity)),
    }));
};

const getPartnerTourPerformance = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'partner') {
      return res.status(403).send('Chỉ tài khoản đối tác mới có thể xem báo cáo này');
    }

    const filters = normalizeFilters(req.query);
    const period = periodFromFilters(filters);
    if (!period) {
      return res.status(400).send('Khoảng ngày báo cáo không hợp lệ');
    }

    const tourQuery = {
      partner: req.user._id,
      isDeleted: { $ne: true },
    };
    const allTours = await Tour.find(tourQuery).select('_id title').sort({ title: 1 }).lean();

    let selectedTours = allTours;
    if (filters.tourId) {
      selectedTours = allTours.filter((tour) => String(tour._id) === filters.tourId);
      if (!selectedTours.length) {
        return res.status(404).send('Không tìm thấy tour thuộc tài khoản đối tác');
      }
    }

    const tourIds = selectedTours.map((tour) => tour._id);
    let currentOrders = [];
    let currentDepartures = [];
    let previousOrders = [];
    let previousDepartures = [];
    let dailyOrders = [];
    let dailyDepartures = [];

    if (tourIds.length) {
      [
        currentOrders,
        currentDepartures,
        previousOrders,
        previousDepartures,
        dailyOrders,
        dailyDepartures,
      ] = await Promise.all([
        aggregateOrders(tourIds, period.start, period.end),
        aggregateDepartures(tourIds, period.start, period.end),
        aggregateOrders(tourIds, period.previousStart, period.previousEnd),
        aggregateDepartures(tourIds, period.previousStart, period.previousEnd),
        aggregateOrders(tourIds, period.start, period.end, true),
        aggregateDepartures(tourIds, period.start, period.end, true),
      ]);
    }

    const current = periodSummary(selectedTours, currentOrders, currentDepartures);
    const previous = periodSummary(selectedTours, previousOrders, previousDepartures);
    const previousByTour = new Map(previous.rows.map((row) => [row.tourId, row]));

    const reportRows = current.rows
      .map((row) => ({
        ...row,
        previousRevenue: previousByTour.get(row.tourId)?.revenue || 0,
        revenueChange: comparison(row.revenue, previousByTour.get(row.tourId)?.revenue || 0).change,
      }))
      .sort((a, b) => b.revenue - a.revenue || b.occupancyRate - a.occupancyRate);

    const metrics = {
      revenue: comparison(current.totals.revenue, previous.totals.revenue),
      paidOrders: comparison(current.totals.paidOrders, previous.totals.paidOrders),
      guests: comparison(current.totals.guests, previous.totals.guests),
      occupancyRate: comparison(current.totals.occupancyRate, previous.totals.occupancyRate),
      cancellationRate: comparison(current.totals.cancellationRate, previous.totals.cancellationRate),
    };

    return res.render('Revenue/Partner/TourPerformance', {
      pageTitle: 'Báo Cáo Hiệu Suất Tour',
      partnerName: req.user.name || 'Đối tác',
      tours: allTours,
      filters,
      period: {
        fromDate: filters.fromDate,
        toDate: filters.toDate,
        previousFromDate: moment(period.previousStart).tz(VN_TZ).format('YYYY-MM-DD'),
        previousToDate: moment(period.previousEnd).tz(VN_TZ).format('YYYY-MM-DD'),
      },
      metrics,
      totals: current.totals,
      reportRows,
      trendData: buildTrend(period, dailyOrders, dailyDepartures),
    });
  } catch (error) {
    console.error('Error loading partner tour performance report:', error);
    return res.status(500).send('Không thể tải báo cáo hiệu suất tour');
  }
};

module.exports = { getPartnerTourPerformance };
