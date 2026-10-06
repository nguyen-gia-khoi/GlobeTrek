const moment = require('moment-timezone');
const TourDeparture = require('../../models/TourDeparture');
const Order = require('../../models/Order');
const { Tour } = require('../../models/Tour');

const VN_TZ = 'Asia/Ho_Chi_Minh';
const PAGE_SIZE = 10;

const startOfDay = (value) => moment.tz(value, VN_TZ).startOf('day').toDate();
const endOfDay = (value) => moment.tz(value, VN_TZ).endOf('day').toDate();
const dateKey = (value) => moment(value).tz(VN_TZ).format('YYYY-MM-DD');
const dateText = (value) => moment(value).tz(VN_TZ).format('DD/MM/YYYY');

const parsePage = (value) => {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
};

const normalizeFilters = (query = {}) => {
  const allowedStatuses = new Set(['', 'open', 'closed', 'canceled', 'departed']);
  const allowedSorts = new Set(['date_asc', 'date_desc', 'available_asc', 'available_desc']);
  return {
    search: String(query.search || '').trim().slice(0, 200),
    status: allowedStatuses.has(query.status) ? query.status : '',
    fromDate: /^\d{4}-\d{2}-\d{2}$/.test(query.fromDate || '') ? query.fromDate : '',
    toDate: /^\d{4}-\d{2}-\d{2}$/.test(query.toDate || '') ? query.toDate : '',
    sort: allowedSorts.has(query.sort) ? query.sort : 'date_asc',
  };
};

const serializeDeparture = (departure) => ({
  id: String(departure._id),
  tourId: String(departure.tour?._id || departure.tour),
  title: departure.title,
  departureDate: dateKey(departure.departureDate),
  departureText: dateText(departure.departureDate),
  capacity: departure.capacity,
  heldSeats: departure.heldSeats,
  soldSeats: departure.soldSeats,
  availableSeats: Math.max(0, departure.capacity - departure.heldSeats - departure.soldSeats),
  status: departure.status,
  note: departure.note || '',
});

const listDepartures = async (req, res) => {
  try {
    const partnerTourIds = await Tour.find({ partner: req.user._id }).distinct('_id');
    await TourDeparture.updateMany(
      {
        tour: { $in: partnerTourIds },
        departureDate: { $lt: startOfDay(new Date()) },
        status: { $in: ['open', 'closed'] },
      },
      { $set: { status: 'departed' } }
    );

    const filters = normalizeFilters(req.query);
    const requestedPage = parsePage(req.query.page);
    const match = {};
    if (filters.status) match.status = filters.status;
    if (filters.fromDate || filters.toDate) {
      match.departureDate = {};
      if (filters.fromDate) match.departureDate.$gte = startOfDay(filters.fromDate);
      if (filters.toDate) match.departureDate.$lte = endOfDay(filters.toDate);
    }

    const sortMap = {
      date_asc: { departureDate: 1, _id: 1 },
      date_desc: { departureDate: -1, _id: 1 },
      available_asc: { availableSeats: 1, departureDate: 1 },
      available_desc: { availableSeats: -1, departureDate: 1 },
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
      { $unwind: '$tourDoc' },
      { $match: { 'tourDoc.partner': req.user._id } },
    ];
    if (filters.search) {
      pipeline.push({
        $match: { 'tourDoc.title': { $regex: filters.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
      });
    }
    pipeline.push(
      {
        $addFields: {
          title: '$tourDoc.title',
          availableSeats: {
            $max: [0, { $subtract: ['$capacity', { $add: ['$heldSeats', '$soldSeats'] }] }],
          },
        },
      },
      { $sort: sortMap[filters.sort] },
      {
        $facet: {
          meta: [{ $count: 'total' }],
          rows: [
            { $skip: (requestedPage - 1) * PAGE_SIZE },
            { $limit: PAGE_SIZE },
            { $project: { tourDoc: 0 } },
          ],
        },
      }
    );

    let [result] = await TourDeparture.aggregate(pipeline);
    const total = result.meta[0]?.total || 0;
    const totalPages = total === 0 ? 0 : Math.ceil(total / PAGE_SIZE);
    const currentPage = totalPages === 0 ? 1 : Math.min(requestedPage, totalPages);
    if (currentPage !== requestedPage) {
      const facet = pipeline[pipeline.length - 1].$facet;
      facet.rows[0] = { $skip: (currentPage - 1) * PAGE_SIZE };
      [result] = await TourDeparture.aggregate(pipeline);
    }

    const tours = await Tour.find({
      partner: req.user._id,
      isDeleted: { $ne: true },
    }).select('_id title duration').sort({ title: 1 }).lean();

    res.render('Departures/Partner/list', {
      departures: result.rows.map(serializeDeparture),
      tours,
      filters,
      total,
      totalPages,
      currentPage,
      pageSize: PAGE_SIZE,
      paginationQuery: new URLSearchParams(filters).toString(),
    });
  } catch (error) {
    console.error('Error listing departures:', error);
    res.status(500).send('Không thể tải lịch khởi hành');
  }
};

const createDepartures = async (req, res) => {
  try {
    const { tourId, capacity, note, mode, dates, startDate, endDate, intervalDays } = req.body;
    const tour = await Tour.findOne({ _id: tourId, partner: req.user._id }).select('_id');
    if (!tour) return res.status(404).json({ message: 'Không tìm thấy tour' });

    const parsedCapacity = Number(capacity);
    if (!Number.isInteger(parsedCapacity) || parsedCapacity < 1) {
      return res.status(400).json({ message: 'Sức chứa phải là số nguyên lớn hơn 0' });
    }

    let values = [];
    if (mode === 'range') {
      const interval = Number(intervalDays);
      if (!startDate || !endDate || !Number.isInteger(interval) || interval < 1) {
        return res.status(400).json({ message: 'Khoảng ngày hoặc chu kỳ không hợp lệ' });
      }
      let cursor = moment.tz(startDate, VN_TZ).startOf('day');
      const last = moment.tz(endDate, VN_TZ).startOf('day');
      while (cursor.isSameOrBefore(last) && values.length < 100) {
        values.push(cursor.toDate());
        cursor = cursor.clone().add(interval, 'days');
      }
    } else {
      const rawDates = Array.isArray(dates) ? dates : [dates];
      values = rawDates.filter(Boolean).map(startOfDay);
    }

    const uniqueDates = [...new Map(values.map((date) => [dateKey(date), date])).values()];
    if (!uniqueDates.length) return res.status(400).json({ message: 'Vui lòng chọn ngày khởi hành' });
    if (uniqueDates.length > 100) return res.status(400).json({ message: 'Chỉ được tạo tối đa 100 lịch mỗi lần' });
    if (uniqueDates.some((date) => date < startOfDay(new Date()))) {
      return res.status(400).json({ message: 'Không thể tạo lịch khởi hành trong quá khứ' });
    }

    const operations = uniqueDates.map((departureDate) => ({
      updateOne: {
        filter: { tour: tour._id, departureDate },
        update: {
          $setOnInsert: {
            tour: tour._id,
            departureDate,
            capacity: parsedCapacity,
            heldSeats: 0,
            soldSeats: 0,
            status: 'open',
            note: String(note || '').trim(),
          },
        },
        upsert: true,
      },
    }));
    const result = await TourDeparture.bulkWrite(operations, { ordered: false });
    res.json({ message: 'Đã tạo lịch khởi hành', created: result.upsertedCount || 0 });
  } catch (error) {
    console.error('Error creating departures:', error);
    res.status(500).json({ message: 'Không thể tạo lịch khởi hành' });
  }
};

const updateDeparture = async (req, res) => {
  try {
    const departure = await TourDeparture.findById(req.params.id).populate('tour', 'partner');
    if (!departure || String(departure.tour?.partner) !== String(req.user._id)) {
      return res.status(404).json({ message: 'Không tìm thấy lịch khởi hành' });
    }

    const capacity = Number(req.body.capacity);
    const minimumCapacity = departure.heldSeats + departure.soldSeats;
    if (!Number.isInteger(capacity) || capacity < Math.max(1, minimumCapacity)) {
      return res.status(400).json({
        message: `Sức chứa không được thấp hơn ${Math.max(1, minimumCapacity)} chỗ đã giữ/đã bán`,
      });
    }
    if (!['open', 'closed'].includes(req.body.status)) {
      return res.status(400).json({ message: 'Trạng thái không hợp lệ' });
    }

    departure.capacity = capacity;
    departure.status = req.body.status;
    departure.note = String(req.body.note || '').trim();
    await departure.save();
    res.json({ message: 'Đã cập nhật lịch khởi hành', departure: serializeDeparture(departure) });
  } catch (error) {
    console.error('Error updating departure:', error);
    res.status(500).json({ message: 'Không thể cập nhật lịch khởi hành' });
  }
};

const deleteDeparture = async (req, res) => {
  try {
    const departure = await TourDeparture.findById(req.params.id).populate('tour', 'partner');
    if (!departure || String(departure.tour?.partner) !== String(req.user._id)) {
      return res.status(404).json({ message: 'Không tìm thấy lịch khởi hành' });
    }
    const hasOrders = await Order.exists({ departure: departure._id });
    if (hasOrders || departure.heldSeats > 0 || departure.soldSeats > 0) {
      return res.status(400).json({ message: 'Lịch đã có đơn và không thể xóa; hãy đóng bán lịch này' });
    }
    await departure.deleteOne();
    res.json({ message: 'Đã xóa lịch khởi hành' });
  } catch (error) {
    console.error('Error deleting departure:', error);
    res.status(500).json({ message: 'Không thể xóa lịch khởi hành' });
  }
};

module.exports = {
  listDepartures,
  createDepartures,
  updateDeparture,
  deleteDeparture,
};
