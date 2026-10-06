const mongoose = require('mongoose');
const { Tour, TourType, Destination, Country } = require('../models/Tour');
const { attachDepartures } = require('../service/departureService');

const attachDepartureAvailability = async (tourDocs) => {
  const payload = await attachDepartures(tourDocs, { openOnly: true, upcomingOnly: true });
  const tours = Array.isArray(payload) ? payload : [payload];
  tours.filter(Boolean).forEach((tour) => {
    // Giữ tên trường cho ứng dụng khách đã phát hành. Dữ liệu lấy từ TourDeparture.
    tour.availabilities = tour.departures;
  });
  return payload;
};

// GET: list of all tours (API)
const getTours = async (req, res) => {
  try {
    const tours = await Tour.find({ isApproved: true }) // Chỉ lấy tour đã được phê duyệt
      .populate('tourType')
      .populate('destination')
      .sort({ createdAt: -1 });

    res.status(200).json(await attachDepartureAvailability(tours));
  } catch (error) {
    console.error('Error fetching tours:', error);
    res.status(500).json({ error: 'Error fetching tours' });
  }
};

// API: Get all tours  (dành cho user)
const getToursAPI = async (req, res) => {
  try {
    const tours = await Tour.find({ isApproved: true, isDeleted: { $ne: true } })
      .populate('tourType')
      .populate('destination')
      .sort({ createdAt: -1 });

    res.json(await attachDepartureAvailability(tours));
  } catch (error) {
    console.error('Error fetching tours:', error);
    res.status(500).json({ error: 'Error fetching tours' });
  }
};

// API: Get a single tour by ID (dành cho user)
const getTourById = async (req, res) => {
  try {
    const tour = await Tour.findOne({ _id: req.params.id, isApproved: true })
      .populate('tourType')
      .populate('destination');

    if (!tour) {
      return res.status(404).json({ error: 'Tour not found' });
    }

    res.json(await attachDepartureAvailability(tour));
  } catch (error) {
    console.error('Error fetching tour by ID:', error);
    res.status(500).json({ error: 'Error fetching tour' });
  }
};

// API: Tìm kiếm & Lọc Tour đa tiêu chí (keyword, destination, tourType, minDuration/maxDuration, minPrice/maxPrice)
const searchTours = async (req, res) => {
  try {
    const {
      query,
      destination,
      tourType,
      country,
      isDomestic,
      scope,
      minDuration,
      maxDuration,
      minPrice,
      maxPrice,
      page,
      limit,
      sortBy,
      order,
    } = req.query;

    const filter = {
      isApproved: true,
      isDeleted: { $ne: true },
      isDisabled: { $ne: true },
    };

    const andConditions = [];

    // 1. Tìm kiếm theo từ khóa tổng hợp (title, location, description, hoặc tên destination / tourType)
    const searchTerm = query
    if (searchTerm && searchTerm.trim()) {
      const kw = searchTerm.trim();

      // Tìm các Destination có tên khớp với từ khóa
      const matchingDestinations = await Destination.find({
        name: { $regex: kw, $options: 'i' },
      }).select('_id');
      const destIds = matchingDestinations.map((d) => d._id);

      // Tìm các TourType có tên khớp với từ khóa
      const matchingTourTypes = await TourType.find({
        name: { $regex: kw, $options: 'i' },
      }).select('_id');
      const typeIds = matchingTourTypes.map((t) => t._id);

      const orList = [
        { title: { $regex: kw, $options: 'i' } },
        { location: { $regex: kw, $options: 'i' } },
        { description: { $regex: kw, $options: 'i' } },
      ];

      if (destIds.length > 0) {
        orList.push({ destination: { $in: destIds } });
      }
      if (typeIds.length > 0) {
        orList.push({ tourType: { $in: typeIds } });
      }

      andConditions.push({ $or: orList });
    }

    // 2. Lọc theo Điểm đến (destination: ObjectId hoặc Tên điểm đến)
    if (destination && destination.trim()) {
      const destStr = destination.trim();
      if (mongoose.Types.ObjectId.isValid(destStr) && String(new mongoose.Types.ObjectId(destStr)) === destStr) {
        andConditions.push({ destination: new mongoose.Types.ObjectId(destStr) });
      } else {
        const destDocs = await Destination.find({
          name: { $regex: destStr, $options: 'i' },
        }).select('_id');
        const ids = destDocs.map((d) => d._id);
        andConditions.push({ destination: { $in: ids } });
      }
    }

    // 3. Lọc theo Loại hình tour (tourType: ObjectId hoặc Tên loại tour)
    if (tourType && tourType.trim()) {
      const typeStr = tourType.trim();
      if (mongoose.Types.ObjectId.isValid(typeStr) && String(new mongoose.Types.ObjectId(typeStr)) === typeStr) {
        andConditions.push({ tourType: new mongoose.Types.ObjectId(typeStr) });
      } else {
        const typeDocs = await TourType.find({
          name: { $regex: typeStr, $options: 'i' },
        }).select('_id');
        const ids = typeDocs.map((t) => t._id);
        andConditions.push({ tourType: { $in: ids } });
      }
    }

    // 4. Lọc theo Quốc gia (country: ObjectId hoặc Tên/Mã quốc gia)
    if (country && country.trim()) {
      const countryStr = country.trim();
      if (mongoose.Types.ObjectId.isValid(countryStr) && String(new mongoose.Types.ObjectId(countryStr)) === countryStr) {
        andConditions.push({ country: new mongoose.Types.ObjectId(countryStr) });
      } else {
        const countryDocs = await Country.find({
          $or: [
            { name: { $regex: countryStr, $options: 'i' } },
            { code: { $regex: countryStr, $options: 'i' } },
          ],
        }).select('_id');
        const ids = countryDocs.map((c) => c._id);
        andConditions.push({ country: { $in: ids } });
      }
    }

    // 5. Lọc Tour Trong Nước vs Quốc Tế (isDomestic=true/false hoặc scope='domestic'/'international')
    const domesticParam = isDomestic !== undefined ? isDomestic : (scope ? (scope === 'domestic' ? 'true' : (scope === 'international' ? 'false' : undefined)) : undefined);
    if (domesticParam !== undefined && domesticParam !== '') {
      const isDom = domesticParam === true || domesticParam === 'true';
      const vnCountries = await Country.find({
        $or: [
          { name: { $regex: 'Việt Nam', $options: 'i' } },
          { code: 'VN' },
        ],
      }).select('_id');
      const vnIds = vnCountries.map((c) => c._id);

      if (isDom) {
        andConditions.push({ country: { $in: vnIds } });
      } else {
        andConditions.push({ country: { $nin: vnIds } });
      }
    }

    // 6. Lọc theo Số ngày (minDuration, maxDuration)
    if ((minDuration !== undefined && minDuration !== '') || (maxDuration !== undefined && maxDuration !== '')) {
      const durFilter = {};
      if (minDuration !== undefined && minDuration !== '') {
        const minD = Number(minDuration);
        if (!isNaN(minD)) durFilter.$gte = minD;
      }
      if (maxDuration !== undefined && maxDuration !== '') {
        const maxD = Number(maxDuration);
        if (!isNaN(maxD)) durFilter.$lte = maxD;
      }
      if (Object.keys(durFilter).length > 0) {
        andConditions.push({ duration: durFilter });
      }
    }

    // 7. Lọc theo Khoảng giá (minPrice, maxPrice dạng Number)
    if ((minPrice !== undefined && minPrice !== '') || (maxPrice !== undefined && maxPrice !== '')) {
      const priceFilter = {};
      if (minPrice !== undefined && minPrice !== '') {
        const minP = Number(minPrice);
        if (!isNaN(minP)) priceFilter.$gte = minP;
      }
      if (maxPrice !== undefined && maxPrice !== '') {
        const maxP = Number(maxPrice);
        if (!isNaN(maxP)) priceFilter.$lte = maxP;
      }
      if (Object.keys(priceFilter).length > 0) {
        andConditions.push({ price: priceFilter });
      }
    }

    if (andConditions.length > 0) {
      filter.$and = andConditions;
    }

    // Sort order
    let sortObj = { createdAt: -1 };
    if (sortBy === 'price') {
      sortObj = { price: order === 'desc' ? -1 : 1 };
    } else if (sortBy === 'duration') {
      sortObj = { duration: order === 'desc' ? -1 : 1 };
    } else if (sortBy === 'createdAt') {
      sortObj = { createdAt: order === 'asc' ? 1 : -1 };
    }

    // 8. Phân trang phía Server (chỉ kích hoạt khi FE truyền page hoặc limit)
    const isPaginationRequested = req.query.page !== undefined || req.query.limit !== undefined;

    if (isPaginationRequested) {
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.max(1, parseInt(limit, 10) || 10);
      const skip = (pageNum - 1) * limitNum;

      const [total, tours] = await Promise.all([
        Tour.countDocuments(filter),
        Tour.find(filter)
          .populate('tourType')
          .populate('destination')
          .populate('country')
          .populate('region')
          .sort(sortObj)
          .skip(skip)
          .limit(limitNum),
      ]);

      res.setHeader('X-Total-Count', total);
      return res.status(200).json({
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
        data: await attachDepartureAvailability(tours),
      });
    }

    // Mặc định không truyền page/limit: Trả về mảng thuần như cũ để tương thích 100% FE
    const tours = await Tour.find(filter)
      .populate('tourType')
      .populate('destination')
      .populate('country')
      .populate('region')
      .sort(sortObj);

    res.setHeader('X-Total-Count', tours.length);
    res.status(200).json(await attachDepartureAvailability(tours));
  } catch (error) {
    console.error('Error in searchTours:', error);
    res.status(500).json({ message: 'Không thể tìm kiếm tour', error: error.message });
  }
};

module.exports = {
  getTours,
  getToursAPI,
  getTourById,
  searchTours,
};
