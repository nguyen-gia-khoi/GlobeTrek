const { Tour } = require('../models/Tour');
const { quoteOrder, PromotionError } = require('../service/promotionService');
const { resolveDeparture } = require('../service/departureService');

const quote = async (req, res) => {
  try {
    const { tourId, departureId, bookingDate, adultCount, childCount, adultPrice, childPrice, code } = req.body;
    const tour = await Tour.findById(tourId);
    if (!tour || tour.isDeleted || !tour.isApproved) {
      return res.status(404).json({ message: 'Không tìm thấy tour' });
    }
    const departure = await resolveDeparture({
      tourId,
      departureId,
      bookingDate,
      requireOpen: true,
    });
    if (!departure) {
      return res.status(400).json({ message: 'Không tìm thấy lịch khởi hành đang mở bán' });
    }
    const result = await quoteOrder({
      tour,
      departure,
      adultCount,
      childCount,
      adultPrice,
      childPrice,
      code,
      userId: req.user._id,
    });
    res.json(result);
  } catch (error) {
    const status = error instanceof PromotionError ? error.status : 500;
    if (status === 500) console.error('Error quoting promotion:', error);
    res.status(status).json({ message: error.message || 'Không thể tính ưu đãi' });
  }
};

module.exports = { quote };
