const mongoose = require('mongoose');
const Order = require('../../models/Order'); // Import model Order
const { Tour } = require('../../models/Tour'); // Import model Tour
const User = require('../../models/User');
const TourDeparture = require('../../models/TourDeparture');

const TOUR_PAGE_SIZE = 5;
const PASSENGER_PAGE_SIZE = 8;
const HISTORY_PAGE_SIZE = 10;

const formatDay = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('vi-VN');
};

const formatDateTime = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleString('vi-VN');
};

const statusMeta = (status) => {
  if (status === 'paid') return { text: 'Đã thanh toán', badge: 'badge-gt-success' };
  if (status === 'processing') return { text: 'Đang tiến hành', badge: 'badge-gt-info' };
  if (status === 'canceled') return { text: 'Đã hủy', badge: 'badge-gt-danger' };
  return { text: 'Chờ xử lý', badge: 'badge-gt-warning' };
};

const passengerName = (order) => {
  const passenger = order.passengerInfo || {};
  const customer = order.customerInfo || {};
  const named = passenger.fullName || customer.fullName || order.user?.name;
  if (!named) return order.user?.email || 'Khách vãng lai';
  return passenger.fullName && passenger.title ? `${passenger.title} ${passenger.fullName}` : named;
};

const parsePage = (value) => {
  const page = parseInt(value, 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeFilters = (query = {}) => {
  const search = String(query.search || '').trim().slice(0, 200);
  const departureDate = /^\d{4}-\d{2}-\d{2}$/.test(query.departureDate || '')
    ? query.departureDate
    : '';
  const allowedSorts = new Set([
    'departure_asc',
    'departure_desc',
    'orders_desc',
    'orders_asc',
    'revenue_desc',
    'revenue_asc',
  ]);
  const sort = allowedSorts.has(query.sort) ? query.sort : 'departure_asc';
  return { search, departureDate, sort };
};

const sortStageFor = (sort) => {
  const sortMap = {
    departure_asc: { '_id.bookingDay': 1, '_id.tour': 1 },
    departure_desc: { '_id.bookingDay': -1, '_id.tour': 1 },
    orders_desc: { orderCount: -1, '_id.bookingDay': 1, '_id.tour': 1 },
    orders_asc: { orderCount: 1, '_id.bookingDay': 1, '_id.tour': 1 },
    revenue_desc: { totalValue: -1, '_id.bookingDay': 1, '_id.tour': 1 },
    revenue_asc: { totalValue: 1, '_id.bookingDay': 1, '_id.tour': 1 },
  };
  return sortMap[sort];
};

const moneyText = (value) => `${(Number(value) || 0).toLocaleString('vi-VN')} VNĐ`;

const mapPassenger = (order) => {
  const status = statusMeta(order.status);
  return {
    id: String(order._id),
    name: passengerName(order),
    email: order.customerInfo?.email || order.passengerInfo?.email || order.user?.email || '—',
    phone: order.customerInfo?.phone || order.passengerInfo?.phone || order.user?.phone || order.user?.phoneNumber || '—',
    adults: order.adultCount || 0,
    children: order.childCount || 0,
    totalText: moneyText(order.totalValue),
    statusText: status.text,
    statusBadge: status.badge,
    bookingText: formatDay(order.bookingDate),
    createdText: formatDateTime(order.createdAt),
  };
};

const listPartnerTourGroups = async (partnerId, page, filters) => {
  const tourFilter = { partner: partnerId };
  if (filters.search) {
    tourFilter.title = { $regex: escapeRegex(filters.search), $options: 'i' };
  }

  const partnerTours = await Tour.find(tourFilter).select('_id').lean();
  const tourIds = partnerTours.map((tour) => tour._id);
  if (!tourIds.length) {
    return {
      tourGroups: [],
      totalTours: 0,
      totalPages: 0,
      currentPage: 1,
      pageSize: TOUR_PAGE_SIZE,
      filters,
      paginationQuery: new URLSearchParams(filters).toString(),
    };
  }

  const orderMatch = { tour: { $in: tourIds } };
  if (filters.departureDate) {
    const departureStart = new Date(`${filters.departureDate}T00:00:00+07:00`);
    orderMatch.bookingDate = {
      $gte: departureStart,
      $lt: new Date(departureStart.getTime() + 24 * 60 * 60 * 1000),
    };
  }

  const stages = [
    { $match: orderMatch },
    {
      $group: {
        _id: {
          tour: '$tour',
          bookingDay: {
            $dateToString: {
              date: '$bookingDate',
              format: '%Y-%m-%d',
              timezone: 'Asia/Ho_Chi_Minh',
            },
          },
        },
        orderCount: { $sum: 1 },
        adultCount: { $sum: { $ifNull: ['$adultCount', 0] } },
        childCount: { $sum: { $ifNull: ['$childCount', 0] } },
        departureId: { $first: '$departure' },
        totalValue: {
          $sum: {
            $cond: [
              { $eq: ['$status', 'paid'] },
              { $ifNull: ['$totalValue', 0] },
              0,
            ],
          },
        },
      },
    },
    { $sort: sortStageFor(filters.sort) },
  ];

  const loadPage = async (skip) => {
    const [result] = await Order.aggregate([
      ...stages,
      {
        $facet: {
          meta: [{ $count: 'total' }],
          rows: [
            { $skip: skip },
            { $limit: TOUR_PAGE_SIZE },
            {
              $lookup: {
                from: Tour.collection.name,
                localField: '_id.tour',
                foreignField: '_id',
                as: 'tourDoc',
              },
            },
            {
              $project: {
                orderCount: 1,
                adultCount: 1,
                childCount: 1,
                totalValue: 1,
                bookingDay: '$_id.bookingDay',
                tourId: '$_id.tour',
                departureId: 1,
                title: {
                  $ifNull: [{ $arrayElemAt: ['$tourDoc.title', 0] }, 'Tour không còn tồn tại'],
                },
              },
            },
          ],
        },
      },
    ]);
    return result;
  };

  let result = await loadPage((page - 1) * TOUR_PAGE_SIZE);
  const totalTours = result.meta[0]?.total || 0;
  const totalPages = totalTours === 0 ? 0 : Math.ceil(totalTours / TOUR_PAGE_SIZE);
  const currentPage = totalPages === 0 ? 1 : Math.min(page, totalPages);
  if (totalPages > 0 && currentPage !== page) {
    result = await loadPage((currentPage - 1) * TOUR_PAGE_SIZE);
  }

  const tourGroups = result.rows.map((group) => ({
    tourId: String(group.tourId),
    departureId: group.departureId ? String(group.departureId) : '',
    departureDate: group.bookingDay,
    title: group.title,
    orderCount: group.orderCount,
    adultCount: group.adultCount,
    childCount: group.childCount,
    guestCount: group.adultCount + group.childCount,
    totalText: moneyText(group.totalValue),
    departureText: formatDay(`${group.bookingDay}T00:00:00+07:00`),
  }));

  return {
    tourGroups,
    totalTours,
    totalPages,
    currentPage,
    pageSize: TOUR_PAGE_SIZE,
    filters,
    paginationQuery: new URLSearchParams(filters).toString(),
  };
};

// Hàm lấy danh sách đơn hàng của Partner
const getPartnerOrders = async (req, res) => {
  try {
    const partnerId = req.user._id;
    const partnerTours = await Tour.find({ partner: partnerId }).select('_id');
    const tourIds = partnerTours.map(tour => tour._id);

    if (tourIds.length === 0) {
      return res.status(200).json({ orders: [] });
    }

    const orders = await Order.find({
      tour: { $in: tourIds }
    })
    .populate('tour', 'title')
    .populate('user', 'email')
    .exec();

    res.status(200).json({ orders });
  } catch (error) {
    console.error("Error in getPartnerOrders:", error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Hàm render trang danh sách đơn hàng của Partner
const renderPartnerOrdersPage = async (req, res) => {
  try {
    const filters = normalizeFilters(req.query);
    const pageData = await listPartnerTourGroups(req.user._id, parsePage(req.query.page), filters);
    res.render('Order/partnerOrders', pageData);
  } catch (error) {
    console.error("Error in renderPartnerOrdersPage:", error);
    res.status(500).send('Server error');
  }
};

const getTourPassengers = async (req, res) => {
  try {
    const { tourId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(tourId)) {
      return res.status(400).json({ message: 'Tour không hợp lệ' });
    }

    const tour = await Tour.findOne({ _id: tourId, partner: req.user._id }).select('title').lean();
    if (!tour) {
      return res.status(404).json({ message: 'Không tìm thấy tour' });
    }

    const departureDate = /^\d{4}-\d{2}-\d{2}$/.test(req.query.departureDate || '')
      ? req.query.departureDate
      : '';
    const departureId = mongoose.Types.ObjectId.isValid(req.query.departureId)
      ? new mongoose.Types.ObjectId(req.query.departureId)
      : null;
    if (departureId) {
      const ownedDeparture = await TourDeparture.findOne({ _id: departureId, tour: tour._id }).select('_id');
      if (!ownedDeparture) return res.status(404).json({ message: 'Không tìm thấy lịch khởi hành' });
    }
    if (!departureDate && !departureId) {
      return res.status(400).json({ message: 'Ngày khởi hành không hợp lệ' });
    }

    const departureStart = departureDate ? new Date(`${departureDate}T00:00:00+07:00`) : null;
    const requestedPage = parsePage(req.query.page);
    const filter = {
      tour: new mongoose.Types.ObjectId(tourId),
      ...(departureId ? { departure: departureId } : { bookingDate: {
        $gte: departureStart,
        $lt: new Date(departureStart.getTime() + 24 * 60 * 60 * 1000),
      } }),
    };
    const total = await Order.countDocuments(filter);
    const totalPages = total === 0 ? 0 : Math.ceil(total / PASSENGER_PAGE_SIZE);
    const currentPage = totalPages === 0 ? 1 : Math.min(requestedPage, totalPages);
    const orders = total === 0
      ? []
      : await Order.find(filter)
        .sort({ createdAt: -1 })
        .skip((currentPage - 1) * PASSENGER_PAGE_SIZE)
        .limit(PASSENGER_PAGE_SIZE)
        .populate('user', 'name email phone phoneNumber')
        .select('passengerInfo customerInfo adultCount childCount totalValue status bookingDate createdAt')
        .lean();

    res.json({
      title: tour.title,
      departureDate,
      departureText: departureStart ? formatDay(departureStart) : '',
      page: currentPage,
      pageSize: PASSENGER_PAGE_SIZE,
      total,
      totalPages,
      passengers: orders.map(mapPassenger),
    });
  } catch (error) {
    console.error('Error in getTourPassengers:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const historyFilters = (query = {}) => {
  const search = String(query.search || '').trim().slice(0, 200);
  const allowedStatus = new Set(['', 'paid', 'pending', 'processing', 'canceled']);
  const status = allowedStatus.has(query.status) ? query.status : '';
  const allowedSorts = new Set(['created_desc', 'created_asc', 'value_desc', 'value_asc']);
  const sort = allowedSorts.has(query.sort) ? query.sort : 'created_desc';
  return { search, status, sort };
};

const renderPurchaseHistoryPage = async (req, res) => {
  try {
    const filters = historyFilters(req.query);
    const requestedPage = parsePage(req.query.page);
    const tourIds = await Tour.find({ partner: req.user._id }).distinct('_id');
    if (!tourIds.length) {
      return res.render('Order/partnerPurchaseHistory', {
        purchases: [],
        filters,
        total: 0,
        totalPages: 0,
        currentPage: 1,
        pageSize: HISTORY_PAGE_SIZE,
      });
    }

    const match = { tour: { $in: tourIds } };
    if (filters.status) match.status = filters.status;
    const sortMap = {
      created_desc: { createdAt: -1, _id: -1 },
      created_asc: { createdAt: 1, _id: 1 },
      value_desc: { totalValue: -1, createdAt: -1 },
      value_asc: { totalValue: 1, createdAt: -1 },
    };
    const pipeline = [
      { $match: match },
      {
        $lookup: {
          from: Tour.collection.name,
          localField: 'tour',
          foreignField: '_id',
          as: 'tourDoc',
        },
      },
      { $unwind: { path: '$tourDoc', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: User.collection.name,
          localField: 'user',
          foreignField: '_id',
          as: 'userDoc',
        },
      },
      { $unwind: { path: '$userDoc', preserveNullAndEmptyArrays: true } },
    ];
    if (filters.search) {
      const pattern = new RegExp(escapeRegex(filters.search), 'i');
      pipeline.push({
        $match: {
          $or: [
            { 'tourDoc.title': pattern },
            { 'userDoc.name': pattern },
            { 'userDoc.email': pattern },
            { 'userDoc.phone': pattern },
            { 'userDoc.phoneNumber': pattern },
            { 'customerInfo.fullName': pattern },
            { 'customerInfo.email': pattern },
            { 'customerInfo.phone': pattern },
            { 'passengerInfo.fullName': pattern },
            { 'passengerInfo.email': pattern },
            { 'passengerInfo.phone': pattern },
          ],
        },
      });
    }
    pipeline.push(
      { $sort: sortMap[filters.sort] },
      {
        $facet: {
          meta: [{ $count: 'total' }],
          rows: [
            { $skip: (requestedPage - 1) * HISTORY_PAGE_SIZE },
            { $limit: HISTORY_PAGE_SIZE },
          ],
        },
      }
    );

    let [result] = await Order.aggregate(pipeline);
    const total = result.meta[0]?.total || 0;
    const totalPages = total === 0 ? 0 : Math.ceil(total / HISTORY_PAGE_SIZE);
    const currentPage = totalPages === 0 ? 1 : Math.min(requestedPage, totalPages);
    if (currentPage !== requestedPage) {
      const facet = pipeline[pipeline.length - 1].$facet;
      facet.rows[0] = { $skip: (currentPage - 1) * HISTORY_PAGE_SIZE };
      [result] = await Order.aggregate(pipeline);
    }

    const purchases = result.rows.map((order) => {
      const status = statusMeta(order.status);
      const discount = Number(order.discountAmount) || 0;
      return {
        id: String(order._id),
        customer: passengerName({ ...order, user: order.userDoc }),
        email: order.customerInfo?.email || order.passengerInfo?.email || order.userDoc?.email || '—',
        phone: order.customerInfo?.phone || order.passengerInfo?.phone || order.userDoc?.phone || order.userDoc?.phoneNumber || '—',
        tour: order.tourDoc?.title || 'Tour đã xóa',
        departureText: formatDay(order.bookingDate),
        createdText: formatDateTime(order.createdAt || order.orderDate),
        guests: `${order.adultCount || 0} người lớn, ${order.childCount || 0} trẻ em`,
        originalText: moneyText(order.originalTotal ?? order.totalValue),
        discountText: discount > 0 ? moneyText(discount) : '—',
        totalText: moneyText(order.totalValue),
        statusText: status.text,
        statusBadge: status.badge,
      };
    });

    res.render('Order/partnerPurchaseHistory', {
      purchases,
      filters,
      total,
      totalPages,
      currentPage,
      pageSize: HISTORY_PAGE_SIZE,
    });
  } catch (error) {
    console.error('Error in renderPurchaseHistoryPage:', error);
    res.status(500).send('Server error');
  }
};

module.exports = {
  getPartnerOrders,
  renderPartnerOrdersPage,
  getTourPassengers,
  renderPurchaseHistoryPage,
};
