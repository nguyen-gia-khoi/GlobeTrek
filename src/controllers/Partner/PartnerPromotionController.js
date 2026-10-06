const moment = require('moment-timezone');
const { Tour } = require('../../models/Tour');
const Promotion = require('../../models/Promotion');
const { startOfDay, endOfDay } = require('../../service/promotionService');

const PAGE_SIZE = 10;

const parsePage = (value) => {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
};

const dateKey = (value) => (value ? moment(value).tz('Asia/Ho_Chi_Minh').format('YYYY-MM-DD') : '');

const serialize = (promotion, titles) => ({
  id: String(promotion._id),
  kind: promotion.kind,
  code: promotion.code || '',
  name: promotion.name,
  discountType: promotion.discountType,
  discountValue: promotion.discountValue,
  tourIds: (promotion.tourIds || []).map(String),
  tourText: promotion.tourIds?.length
    ? promotion.tourIds.map((id) => titles.get(String(id)) || 'Tour').join(', ')
    : 'Tất cả tour',
  bookingStart: dateKey(promotion.bookingStart),
  bookingEnd: dateKey(promotion.bookingEnd),
  departureStart: dateKey(promotion.departureStart),
  departureEnd: dateKey(promotion.departureEnd),
  minSubtotal: promotion.minSubtotal || 0,
  usageLimit: promotion.usageLimit,
  perUserLimit: promotion.perUserLimit,
  usedCount: promotion.usedCount || 0,
  status: promotion.status,
});

const readPayload = (body, kind) => {
  const discountType = body.discountType === 'fixed' ? 'fixed' : 'percent';
  const discountValue = Number(body.discountValue);
  if (discountType === 'percent' && (!Number.isInteger(discountValue) || discountValue < 1 || discountValue > 100)) {
    return { error: 'Phần trăm giảm phải từ 1 đến 100' };
  }
  if (discountType === 'fixed' && (!Number.isInteger(discountValue) || discountValue < 1)) {
    return { error: 'Số tiền giảm phải là số nguyên lớn hơn 0' };
  }

  const name = String(body.name || '').trim();
  if (!name || name.length > 120) return { error: 'Tên ưu đãi là bắt buộc và tối đa 120 ký tự' };

  const code = String(body.code || '').trim().toUpperCase();
  if (kind === 'code' && !/^[A-Z0-9]{4,20}$/.test(code)) {
    return { error: 'Mã gồm 4-20 ký tự chữ và số' };
  }

  const limit = (value) => {
    if (value === undefined || value === null || value === '') return null;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1) return undefined;
    return parsed;
  };
  const usageLimit = limit(body.usageLimit);
  const perUserLimit = limit(body.perUserLimit);
  if (usageLimit === undefined || perUserLimit === undefined) {
    return { error: 'Giới hạn lượt dùng phải là số nguyên lớn hơn 0' };
  }

  const minSubtotal = body.minSubtotal === undefined || body.minSubtotal === '' ? 0 : Number(body.minSubtotal);
  if (!Number.isInteger(minSubtotal) || minSubtotal < 0) {
    return { error: 'Giá trị đơn tối thiểu không hợp lệ' };
  }

  const bookingStart = startOfDay(body.bookingStart);
  const bookingEnd = endOfDay(body.bookingEnd);
  const departureStart = startOfDay(body.departureStart);
  const departureEnd = endOfDay(body.departureEnd);
  if ((body.bookingStart && !bookingStart) || (body.bookingEnd && !bookingEnd)) {
    return { error: 'Thời gian đặt không hợp lệ' };
  }
  if (bookingStart && bookingEnd && bookingStart > bookingEnd) {
    return { error: 'Ngày đặt kết thúc phải sau ngày bắt đầu' };
  }
  if (departureStart && departureEnd && departureStart > departureEnd) {
    return { error: 'Ngày khởi hành kết thúc phải sau ngày bắt đầu' };
  }

  const tourIds = (Array.isArray(body.tourIds) ? body.tourIds : [body.tourIds])
    .map((id) => String(id || '').trim())
    .filter(Boolean);

  return {
    value: {
      kind,
      code: kind === 'code' ? code : '',
      name,
      discountType,
      discountValue,
      tourIds,
      bookingStart,
      bookingEnd,
      departureStart,
      departureEnd,
      minSubtotal,
      usageLimit,
      perUserLimit,
    },
  };
};

const ownedTours = (partnerId, tourIds) => Tour.find({
  _id: { $in: tourIds },
  partner: partnerId,
  isDeleted: { $ne: true },
}).select('_id');

const listPromotions = async (req, res) => {
  try {
    const kind = req.query.kind === 'automatic' ? 'automatic' : 'code';
    await Promotion.updateMany(
      { partner: req.user._id, status: 'active', bookingEnd: { $lt: new Date() } },
      { $set: { status: 'expired' } }
    );

    const status = ['active', 'paused', 'expired'].includes(req.query.status) ? req.query.status : '';
    const search = String(req.query.search || '').trim().slice(0, 80);
    const requestedPage = parsePage(req.query.page);
    const filter = { partner: req.user._id, kind };
    if (status) filter.status = status;
    if (search) {
      const pattern = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ name: pattern }, { code: pattern }];
    }

    const total = await Promotion.countDocuments(filter);
    const totalPages = total === 0 ? 0 : Math.ceil(total / PAGE_SIZE);
    const currentPage = totalPages === 0 ? 1 : Math.min(requestedPage, totalPages);
    const rows = await Promotion.find(filter)
      .sort({ createdAt: -1 })
      .skip((currentPage - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .lean();
    const tours = await Tour.find({ partner: req.user._id, isDeleted: { $ne: true } })
      .select('_id title')
      .sort({ title: 1 })
      .lean();
    const titles = new Map(tours.map((tour) => [String(tour._id), tour.title]));

    res.render('Promotions/Partner/list', {
      kind,
      promotions: rows.map((row) => serialize(row, titles)),
      tours,
      filters: { status, search },
      total,
      totalPages,
      currentPage,
      pageSize: PAGE_SIZE,
    });
  } catch (error) {
    console.error('Error listing promotions:', error);
    res.status(500).send('Không thể tải danh sách ưu đãi');
  }
};

const createPromotion = async (req, res) => {
  try {
    const kind = req.body.kind === 'automatic' ? 'automatic' : 'code';
    const parsed = readPayload(req.body, kind);
    if (parsed.error) return res.status(400).json({ message: parsed.error });
    if (parsed.value.tourIds.length) {
      const tours = await ownedTours(req.user._id, parsed.value.tourIds);
      if (tours.length !== parsed.value.tourIds.length) {
        return res.status(400).json({ message: 'Có tour không thuộc quyền quản lý của bạn' });
      }
    }
    const status = parsed.value.bookingEnd && parsed.value.bookingEnd < new Date() ? 'expired' : 'active';
    await Promotion.create({ ...parsed.value, partner: req.user._id, status });
    res.status(201).json({ message: 'Đã tạo ưu đãi' });
  } catch (error) {
    if (error.code === 11000) return res.status(400).json({ message: 'Mã giảm giá đã tồn tại' });
    console.error('Error creating promotion:', error);
    res.status(500).json({ message: 'Không thể tạo ưu đãi' });
  }
};

const updatePromotion = async (req, res) => {
  try {
    const promotion = await Promotion.findOne({ _id: req.params.id, partner: req.user._id });
    if (!promotion) return res.status(404).json({ message: 'Không tìm thấy ưu đãi' });

    const parsed = readPayload(req.body, promotion.kind);
    if (parsed.error) return res.status(400).json({ message: parsed.error });
    if (promotion.usedCount > 0) {
      const locked = ['discountType', 'discountValue', 'code', 'kind'];
      const changed = locked.some((field) => String(parsed.value[field]) !== String(promotion[field] || ''));
      if (changed) return res.status(400).json({ message: 'Ưu đãi đã có lượt dùng, không thể đổi mức giảm hoặc mã' });
    }
    if (parsed.value.tourIds.length) {
      const tours = await ownedTours(req.user._id, parsed.value.tourIds);
      if (tours.length !== parsed.value.tourIds.length) {
        return res.status(400).json({ message: 'Có tour không thuộc quyền quản lý của bạn' });
      }
    }

    let status = req.body.status === 'paused' ? 'paused' : 'active';
    if (parsed.value.bookingEnd && parsed.value.bookingEnd < new Date()) status = 'expired';
    Object.assign(promotion, parsed.value, { status });
    await promotion.save();
    res.json({ message: 'Đã cập nhật ưu đãi' });
  } catch (error) {
    if (error.code === 11000) return res.status(400).json({ message: 'Mã giảm giá đã tồn tại' });
    console.error('Error updating promotion:', error);
    res.status(500).json({ message: 'Không thể cập nhật ưu đãi' });
  }
};

const deletePromotion = async (req, res) => {
  try {
    const promotion = await Promotion.findOne({ _id: req.params.id, partner: req.user._id });
    if (!promotion) return res.status(404).json({ message: 'Không tìm thấy ưu đãi' });
    if (promotion.usedCount > 0) {
      return res.status(400).json({ message: 'Ưu đãi đã có lượt dùng, chỉ có thể tạm dừng' });
    }
    await promotion.deleteOne();
    res.json({ message: 'Đã xóa ưu đãi' });
  } catch (error) {
    console.error('Error deleting promotion:', error);
    res.status(500).json({ message: 'Không thể xóa ưu đãi' });
  }
};

module.exports = {
  listPromotions,
  createPromotion,
  updatePromotion,
  deletePromotion,
};
