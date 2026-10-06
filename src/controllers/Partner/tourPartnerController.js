const mongoose = require('mongoose');
const { Tour, TourType, Destination, Country, Region } = require('../../models/Tour');
const cloudinary = require('cloudinary').v2;
const { storage } = require('../../Middleware/cloudinary');
const multer = require('multer');
const upload = multer({ storage });
const moment = require('moment-timezone');
const Order  = require('../../models/Order')
const TourDeparture = require('../../models/TourDeparture');
const { attachDepartures } = require('../../service/departureService');

const SPECIAL_DAY_MULTIPLIER = 1.5;
const CHILD_MULTIPLIER = 0.75;

// Get userId from the token
const partnerIdFromRequest = (req) => (req.user && req.user.role === 'partner' ? String(req.user._id) : null);

// Get list of tours for a partner with full multi-criteria filters
const getTourList = async (req, res) => {
  try {
    const partnerId = partnerIdFromRequest(req);
    if (!partnerId) {
      return res.status(401).send('Unauthorized');
    }

    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const skip = (page - 1) * limit;

    const {
      status,
      country,
      region,
      destination,
      date,
      duration,
      search,
    } = req.query;

    const filter = { 
      partner: new mongoose.Types.ObjectId(partnerId),
      isDeleted: { $ne: true } 
    };

    // 1. Lọc theo trạng thái
    if (status === 'active') {
      filter.isApproved = true;
      filter.isDisabled = false;
    } else if (status === 'disabled') {
      filter.isApproved = true;
      filter.isDisabled = true;
    } else if (status === 'pending') {
      filter.isApproved = false;
    }

    // 2. Lọc theo Quốc gia
    if (country && mongoose.Types.ObjectId.isValid(country)) {
      filter.country = new mongoose.Types.ObjectId(country);
    }

    // 3. Lọc theo Vùng miền
    if (region && mongoose.Types.ObjectId.isValid(region)) {
      filter.region = new mongoose.Types.ObjectId(region);
    }

    // 4. Lọc theo Điểm đến
    if (destination && mongoose.Types.ObjectId.isValid(destination)) {
      filter.destination = new mongoose.Types.ObjectId(destination);
    }

    // 5. Lọc theo ngày có lịch khởi hành
    if (date) {
      const startRange = moment.tz(date, 'Asia/Ho_Chi_Minh').startOf('day').toDate();
      const endRange = moment.tz(date, 'Asia/Ho_Chi_Minh').endOf('day').toDate();
      const departureTourIds = await TourDeparture.distinct('tour', {
        departureDate: { $gte: startRange, $lte: endRange },
      });
      filter._id = { $in: departureTourIds };
    }

    // 6. Lọc theo số ngày (duration)
    if (duration) {
      if (duration === '6+') {
        filter.duration = { $gte: 6 };
      } else {
        const numDuration = parseInt(duration);
        if (!isNaN(numDuration)) {
          filter.duration = numDuration;
        }
      }
    }

    // 7. Tìm kiếm theo tên hoặc địa điểm
    if (search && search.trim()) {
      filter.$or = [
        { title: { $regex: search.trim(), $options: 'i' } },
        { location: { $regex: search.trim(), $options: 'i' } },
      ];
    }

    // Lấy danh sách tour của partner
    const tours = await Tour.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('tourType')
      .populate('destination')
      .populate('country')
      .populate('region');

    const totalTours = await Tour.countDocuments(filter);
    const totalPages = Math.ceil(totalTours / limit) || 1;

    // Lấy danh sách điểm đến, quốc gia & vùng miền để hiển thị các options trong filter
    const [destinationsList, countriesList, regionsList] = await Promise.all([
      Destination.find({ isActive: true }).populate('country region').select('_id name country region').sort({ name: 1 }),
      Country.find({ isActive: true }).select('_id name code').sort({ name: 1 }),
      Region.find({ isActive: true }).populate('country').select('_id name country').sort({ name: 1 }),
    ]);

    const toursWithDepartures = await attachDepartures(tours, { openOnly: true });
    const toursWithOrders = await Promise.all(
      toursWithDepartures.map(async (tour) => {
        tour.hasOrders = Boolean(await Order.exists({ tour: tour._id }));
        return tour;
      })
    );

    // Query string cho phân trang để giữ nguyên các filter khi đổi trang
    const queryParams = new URLSearchParams();
    if (status) queryParams.set('status', status);
    if (country) queryParams.set('country', country);
    if (region) queryParams.set('region', region);
    if (destination) queryParams.set('destination', destination);
    if (date) queryParams.set('date', date);
    if (duration) queryParams.set('duration', duration);
    if (search) queryParams.set('search', search);

    const queryString = queryParams.toString();

    res.render('Tours/Partner/list', {
      tours: toursWithOrders,
      currentPage: page,
      totalPages,
      totalTours,
      destinationsList,
      countriesList,
      regionsList,
      filters: {
        status: status || '',
        country: country || '',
        region: region || '',
        destination: destination || '',
        date: date || '',
        duration: duration || '',
        search: search || '',
      },
      queryString: queryString ? `&${queryString}` : '',
    });
  } catch (error) {
    console.error('Error fetching partner tour list:', error);
    res.status(500).send('Error fetching tour list');
  }
};
// Get create tour page
const getCreateTour = async (req, res) => {
  try {
    const [tourTypes, destinations, countries, regions] = await Promise.all([
      TourType.find({ isActive: true }),
      Destination.find({ isActive: true }).populate('country').populate('region').sort({ name: 1 }),
      Country.find({ isActive: true }).sort({ name: 1 }),
      Region.find({ isActive: true }).populate('country').sort({ name: 1 }),
    ]);
    res.render('Tours/Partner/create', { tourTypes, destinations, countries, regions });
  } catch (error) {
    console.error('Error fetching data for creating tour:', error);
    res.status(500).send('Error fetching data');
  }
};

// Post create new tour
const postCreateTour = async (req, res) => {
  const { 
    title, 
    description, 
    price, 
    location, 
    duration, 
    tourType, 
    destination,
    country,
    region,
    schedules, 
    totalSpots, 
    customAvailabilities, 
    availabilityType,
    holidayAdultPercent,
    holidayChildPercent,
    childPercent
  } = req.body;

  try {
    // Get partnerId from token
    const partnerId = partnerIdFromRequest(req);

    // Validate required fields
    if (!title || !description || !price || !location || !duration || !tourType || !destination || !totalSpots) {
      return res.status(400).send('Các trường bắt buộc chưa được điền.');
    }

    // Validate values
    if (price <= 0 || duration < 1 || totalSpots < 1) {
      return res.status(400).send('Thông tin không hợp lệ. Kiểm tra lại giá, thời gian và số chỗ ngồi.');
    }

    // Resolve Country & Region if not explicitly provided
    let selectedCountry = country;
    let selectedRegion = region;
    if ((!selectedCountry || !selectedRegion) && destination) {
      const destDoc = await Destination.findById(destination);
      if (destDoc) {
        if (!selectedCountry) selectedCountry = destDoc.country;
        if (!selectedRegion) selectedRegion = destDoc.region;
      }
    }

    // Handle images and videos (if any)
    const images = req.files?.['images']?.map(file => file.path) || [];
    const videos = req.files?.['videos']?.map(file => file.path) || [];

    // Custom Percentage multipliers (default to 150% and 75%)
    const holidayAdultRate = parseFloat(holidayAdultPercent) >= 0 ? parseFloat(holidayAdultPercent) : 150;
    const holidayChildRate = parseFloat(holidayChildPercent) >= 0 ? parseFloat(holidayChildPercent) : 150;
    const childRate = parseFloat(childPercent) >= 0 ? parseFloat(childPercent) : 75;

    const basePrice = Number(price);
    const childPrice = Math.round((basePrice * childRate) / 100);
    const specialAdultPrice = Math.round((basePrice * holidayAdultRate) / 100);
    const specialChildPrice = Math.round((childPrice * holidayChildRate) / 100);

    // Handle schedules
    const tourSchedules = [];
    for (let i = 1; i <= duration; i++) {
      const activity = (schedules && schedules[i]) || `Ngày ${i + 1}: Mô tả hoạt động cho ngày ${i + 1}`;
      tourSchedules.push({
        day: i + 1,
        activity: activity,
      });
    }
    const departureDates = [];
    const seenDates = new Set();
    const addDepartureDate = (value) => {
      const date = moment.tz(value, 'Asia/Ho_Chi_Minh').startOf('day');
      const key = date.format('YYYY-MM-DD');
      if (!date.isValid() || seenDates.has(key)) return;
      seenDates.add(key);
      departureDates.push(date.toDate());
    };

    if (availabilityType === 'auto') {
      const endDate = moment.tz('Asia/Ho_Chi_Minh').startOf('day').add(30, 'days');
      let nextDate = moment.tz('Asia/Ho_Chi_Minh').startOf('day');
      const interval = Math.max(1, Number(duration));
      while (nextDate.isSameOrBefore(endDate)) {
        addDepartureDate(nextDate);
        nextDate = nextDate.clone().add(interval, 'days');
      }
    } else if (availabilityType === 'custom' && Array.isArray(customAvailabilities) && customAvailabilities.length) {
      customAvailabilities.forEach(addDepartureDate);
    } else {
      return res.status(400).send('Loại lịch khởi hành không hợp lệ (auto/custom).');
    }
    if (!departureDates.length) {
      return res.status(400).send('Vui lòng chọn ít nhất một ngày khởi hành.');
    }

    const newTour = await Tour.create({
      title,
      description,
      price: basePrice,
      location,
      duration,
      partner: partnerId,
      tourType,
      destination,
      country: selectedCountry || null,
      region: selectedRegion || null,
      isDisabled: req.body.isDisabled || false,
      holidayAdultPercent: holidayAdultRate,
      holidayChildPercent: holidayChildRate,
      childPercent: childRate,
      specialAdultPrice,
      childPrice,
      specialChildPrice,
      images,
      videos,
      isApproved: false,
      schedules: tourSchedules,
    });

    await TourDeparture.insertMany(
      departureDates.map((departureDate) => ({
        tour: newTour._id,
        departureDate,
        capacity: Number(totalSpots),
        heldSeats: 0,
        soldSeats: 0,
        status: 'open',
      }))
    );

    res.redirect('/partner/tours/list');
  } catch (error) {
    console.error('Lỗi khi tạo tour:', error);
    res.status(500).send('Có lỗi xảy ra khi tạo tour.');
  }
};



// Get update tour page
const getUpdateTour = async (req, res) => {
  const partnerId = partnerIdFromRequest(req);

  if (!partnerId) {
    return res.status(401).send('Unauthorized: Invalid token');
  }

  try {
    const tour = await Tour.findById(req.params.id)
      .populate('tourType')
      .populate({
        path: 'destination',
        populate: ['country', 'region']
      })
      .populate('country')
      .populate('region');
    
    if (!tour) {
      return res.status(404).send('Tour not found.');
    }
    
    if (tour.partner.toString() !== partnerId) {
      return res.status(403).send('You are not authorized to edit this tour.');
    }

    const [tourTypes, destinations, countries, regions] = await Promise.all([
      TourType.find({ isActive: true }),
      Destination.find({ isActive: true }).populate('country').populate('region').sort({ name: 1 }),
      Country.find({ isActive: true }).sort({ name: 1 }),
      Region.find({ isActive: true }).populate('country').sort({ name: 1 }),
    ]);
    
    res.render('Tours/Partner/edit', { tour, tourTypes, destinations, countries, regions });
  } catch (error) {
    console.error('Error fetching tour for editing:', error);
    res.status(500).send('Error fetching tour');
  }
};

// Post update tour
const postUpdateTour = async (req, res) => {
  const { 
    title, 
    description, 
    price, 
    location, 
    duration, 
    tourType, 
    destination, 
    country,
    region,
    schedules, 
    isDisabled,
    holidayAdultPercent,
    holidayChildPercent,
    childPercent
  } = req.body;
  const partnerId = partnerIdFromRequest(req);
  const tourID = req.params.id;

  if (!partnerId) {
    console.log("Invalid token or partnerId.");
    return res.status(401).send('Unauthorized: Invalid token');
  }

  // Validate required fields
  if (!title || !description || !price || !location || !duration || !tourType || !destination) {
    return res.status(400).send('Missing required fields.');
  }

  // Validate price and duration
  if (price <= 0 || duration < 1) {
    return res.status(400).send('Invalid price or duration.');
  }

  // Resolve Country & Region if not explicitly provided
  let selectedCountry = country;
  let selectedRegion = region;
  if ((!selectedCountry || !selectedRegion) && destination) {
    const destDoc = await Destination.findById(destination);
    if (destDoc) {
      if (!selectedCountry) selectedCountry = destDoc.country;
      if (!selectedRegion) selectedRegion = destDoc.region;
    }
  }

  // Custom Percentage multipliers (default to 150% and 75%)
  const holidayAdultRate = parseFloat(holidayAdultPercent) >= 0 ? parseFloat(holidayAdultPercent) : 150;
  const holidayChildRate = parseFloat(holidayChildPercent) >= 0 ? parseFloat(holidayChildPercent) : 150;
  const childRate = parseFloat(childPercent) >= 0 ? parseFloat(childPercent) : 75;

  const basePrice = Number(price);
  const childPrice = Math.round((basePrice * childRate) / 100);
  const specialAdultPrice = Math.round((basePrice * holidayAdultRate) / 100);
  const specialChildPrice = Math.round((childPrice * holidayChildRate) / 100);

  // Handle schedules
  const tourSchedules = [];
  for (let i = 1; i <= duration; i++) {
    const activity = (schedules && schedules[i]) || `Ngày ${i + 1}: Mô tả hoạt động cho ngày ${i + 1}`;
    tourSchedules.push({
      day: i + 1,
      activity: activity,
    });
  }

  try {
    const existingTour = await Tour.findOne({ _id: tourID, partner: partnerId });
    if (!existingTour) {
      console.log("Tour not found or not owned by this partner.");
      return res.status(404).send('Tour not found or you are not authorized to update this tour.');
    }

    // Process retained images and new uploaded images/videos
    let retainedImages = [];
    if (req.body && req.body.existingImages) {
      retainedImages = Array.isArray(req.body.existingImages) ? req.body.existingImages : [req.body.existingImages];
    } else if (existingTour.images && req.body && !('existingImagesChecked' in req.body)) {
      retainedImages = existingTour.images;
    }

    const newImages = req.files?.['images']?.map(file => file.path) || [];
    const newVideos = req.files?.['videos']?.map(file => file.path) || [];

    const finalImages = [...retainedImages, ...newImages];
    const finalVideos = newVideos.length > 0 ? [...(existingTour.videos || []), ...newVideos] : (existingTour.videos || []);

    const updatedTour = await Tour.findOneAndUpdate(
      { _id: tourID, partner: partnerId },
      {
        title,
        description,
        price: basePrice,
        location,
        duration,
        partner: partnerId,
        tourType,
        destination,
        country: selectedCountry || null,
        region: selectedRegion || null,
        isDisabled: isDisabled ? true : false,
        holidayAdultPercent: holidayAdultRate,
        holidayChildPercent: holidayChildRate,
        childPercent: childRate,
        specialAdultPrice,
        childPrice,
        specialChildPrice,
        schedules: tourSchedules,
        images: finalImages,
        videos: finalVideos,
      },
      { new: true }
    );

    res.redirect('/partner/tours/list');
  } catch (error) {
    console.error('Error updating tour:', error);
    res.status(500).send('Error updating tour');
  }
};

// Gửi yêu cầu phê duyệt cho admin
const requestApproval = async (req, res) => {
  const tourID = req.params.id;
  try {
    const tour = await Tour.findById(tourID);
    if (!tour) {
      return res.status(404).send('Tour not found.');
    }
    if (tour.partner.toString() !== req.user._id.toString()) {
      return res.status(403).send('You are not authorized to request approval for this tour.');
    }

    tour.isApproved = false;
    tour.approvalRequested = true;
    await tour.save();  

    res.render('Tours/Partner/requestTour', { tour });
  } catch (error) {
    console.error('Error requesting approval:', error);
    res.status(500).send('Error requesting approval');
  }
};

// Gửi yêu cầu xóa tour
const requestDeleteTour = async (req, res) => {
  const tourID = req.params.id;
  try {
    // Tìm tour theo ID
    const tour = await Tour.findById(tourID);
    if (!tour) {
      return res.status(404).send('Tour not found.'); 
    }
    if (String(tour.partner) !== String(req.user._id)) {
      return res.status(403).send('You are not authorized to request deletion for this tour.');
    }

    // Kiểm tra nếu tour có đơn hàng đã được đặt
    const orders = await Order.find({ 'tour': tourID });
    if (orders.length > 0) {
      return res.status(400).send('Không thể xóa tour vì đã có đơn hàng liên quan.');
    }

    // Nếu không có đơn hàng, cho phép yêu cầu xóa tour
    tour.isDeleted = false;
    tour.deletionRequested = true;
    await tour.save();

    // Render lại trang yêu cầu xóa tour
    res.render('Tours/Partner/requestTour', { tour });
  } catch (error) {
    console.error('Error requesting deletion:', error);
    res.status(500).send('Error requesting deletion');
  }
};

const toggleTourStatus = async (req, res) => {
  const tourID = req.params.id;
  try {
    const tour = await Tour.findById(tourID);
    if (!tour) {
      return res.status(404).json({ message: 'Không tìm thấy tour' });
    }
    if (String(tour.partner) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Bạn không có quyền thay đổi tour này' });
    }

    // Kiểm tra đơn hàng trước khi bật/tắt tour
    const existingOrders = await Order.find({ 'tour': tourID });
    console.log('Existing Orders:', existingOrders);  
    if (existingOrders.length > 0) {
      return res.status(400).json({ message: 'Không thể tắt tour đã được đặt' });
    }

    // Chuyển trạng thái bật/tắt
    tour.isDisabled = !tour.isDisabled;
    await tour.save();
    res.redirect('/partner/tours/list'); 
  } catch (error) {
    console.error('Lỗi khi xác nhận bật/tắt tour:', error);
    res.status(500).json({ message: 'Lỗi khi xác nhận bật/tắt tour', error });
  }
};

module.exports = {
  getTourList,
  getCreateTour,
  postCreateTour,
  getUpdateTour,
  postUpdateTour,
  requestApproval,
  requestDeleteTour,
  toggleTourStatus,
};
