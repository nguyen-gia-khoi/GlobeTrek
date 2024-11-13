const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { Tour, TourType, Destination } = require('../../models/Tour');
const cloudinary = require('cloudinary').v2;
const { storage } = require('../../Middleware/cloudinary');
const multer = require('multer');
const upload = multer({ storage });
const moment = require('moment');


const SPECIAL_DAY_MULTIPLIER = 1.5;
const CHILD_MULTIPLIER = 0.75;

const getUserIdFromToken = (PartneraccessToken) => {
  try {
    const decoded = jwt.verify(PartneraccessToken, process.env.ACCESS_TOKEN_SECRET);
    return decoded.userId;
  } catch (error) {
    console.error('Token không hợp lệ:', error);
    return null;
  }
};

// Danh sách tour của Partner
const getTourList = async (req, res) => {
  try {
    const token = req.cookies.PartneraccessToken;
    const partnerId = getUserIdFromToken(token);
    if (!partnerId) {
      return res.status(401).send('Unauthorized');
    }

    // Pagination logic
    const page = parseInt(req.query.page) || 1; // Get the current page from query or default to 1
    const limit = 4; // Number of tours per page
    const skip = (page - 1) * limit;

    const tours = await Tour.find({ partner: partnerId })
      .populate('tourType')
      .populate('destination')
      .skip(skip)
      .limit(limit);

    const totalTours = await Tour.countDocuments({ partner: partnerId }); // Get the total number of tours for pagination
    const totalPages = Math.ceil(totalTours / limit); // Calculate the total number of pages

    if (!tours || tours.length === 0) {
      return res.render('Tours/Partner/list', { tours: [], currentPage: page, totalPages: totalPages });
    }

    res.render('Tours/Partner/list', {
      tours,
      currentPage: page,
      totalPages: totalPages
    });
  } catch (error) {
    console.error('Error fetching tour list:', error);
    res.status(500).send('Error fetching tour list');
  }
};


// Tạo tour mới
const getCreateTour = async (req, res) => {
  try {
    const tourTypes = await TourType.find({});
    const destinations = await Destination.find({});
    res.render('Tours/Partner/create', { tourTypes, destinations });
  } catch (error) {
    console.error('Error fetching data for creating tour:', error);
    res.status(500).send('Error fetching data');
  }
};

const postCreateTour = async (req, res) => {
  const { title, description, price, location, duration, tourType, destination, schedules, totalSpots } = req.body;
  const token = req.cookies.PartneraccessToken;
  const partnerId = getUserIdFromToken(token);

  // Kiểm tra các trường bắt buộc
  if (!title || !description || !price || !location || !duration || !tourType || !destination || !totalSpots) {
    return res.status(400).send('Thiếu thông tin bắt buộc.');
  }

  // Kiểm tra giá và thời gian hợp lệ
  if (price <= 0 || duration < 1) {
    return res.status(400).send('Giá hoặc thời gian không hợp lệ.');
  }

  const images = req.files?.['images'] ? req.files['images'].map(file => file.path) : [];
  const videos = req.files?.['videos'] ? req.files['videos'].map(file => file.path) : [];

  const isDisabled = req.body.isDisabled ? true : false;
  const specialAdultPrice = price * SPECIAL_DAY_MULTIPLIER;
  const childPrice = price * CHILD_MULTIPLIER;
  const specialChildPrice = childPrice * SPECIAL_DAY_MULTIPLIER;

  // Xử lý lịch trình (schedules)
  const tourSchedules = [];
  for (let i = 1; i <= duration; i++) {
    const activity = schedules[i] || `Ngày ${i + 1}: Mô tả hoạt động cho ngày ${i + 1}`;
    tourSchedules.push({
      day: i + 1,
      activity: activity,
    });
  }

  // Tạo availability cho 30 ngày (hoặc tùy chọn theo số ngày được nhập)
  const availabilityData = [];
  const totalDays = 30; // Hoặc bạn có thể thay đổi theo `duration` nếu muốn linh hoạt hơn

  for (let i = 0; i < totalDays; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i); // Cộng thêm ngày vào hiện tại
    const formattedDate = date.toISOString().split('T')[0]; // Định dạng ngày theo 'YYYY-MM-DD'
    const availableSeats = Number(totalSpots);

    availabilityData.push({
      date: formattedDate, // Lưu dưới dạng chuỗi 'YYYY-MM-DD'
      availableSeats: availableSeats,
    });
  }

  try {
    // Tạo tour mới và lưu vào DB
    const newTour = await Tour.create({
      title,
      description,
      price,
      location,
      duration,
      partner: partnerId,
      tourType,
      destination,
      isDisabled,
      specialAdultPrice,
      childPrice,
      specialChildPrice,
      images,
      videos,
      isApproved: false,
      schedules: tourSchedules, // Gắn lịch trình vào tour
      availabilities: availabilityData, // Gắn availability vào tour
    });

    // Chuyển hướng về danh sách tour của partner
    res.redirect('/partner/tours/list');
  } catch (error) {
    console.error('Lỗi khi tạo tour:', error);
    res.status(500).send('Lỗi khi tạo tour.');
  }
};

// Cập nhật tour
const getUpdateTour = async (req, res) => {
  const token = req.cookies.PartneraccessToken;
  const partnerId = getUserIdFromToken(token);

  if (!partnerId) {
    return res.status(401).send('Unauthorized: Invalid token');
  }

  try {
    const tour = await Tour.findById(req.params.id).populate('tourType').populate('destination');
    
    if (!tour) {
      return res.status(404).send('Tour not found.');
    }
    
    if (tour.partner.toString() !== partnerId) {
      return res.status(403).send('You are not authorized to edit this tour.');
    }

    const tourTypes = await TourType.find({});
    const destinations = await Destination.find({});
    
    res.render('Tours/Partner/edit', { tour, tourTypes, destinations });
  } catch (error) {
    console.error('Error fetching tour for editing:', error);
    res.status(500).send('Error fetching tour');
  }
};

const postUpdateTour = async (req, res) => {
  const { title, description, price, location, duration, tourType, destination, schedules, isDisabled } = req.body;
  const token = req.cookies.PartneraccessToken;
  const partnerId = getUserIdFromToken(token);
  const tourID = req.params.id; // Correctly use tourID here

  // Kiểm tra xem partnerId có hợp lệ không
  if (!partnerId) {
    console.log("Invalid token or partnerId.");
    return res.status(401).send('Unauthorized: Invalid token');
  }

  // Kiểm tra các trường bắt buộc
  if (!title || !description || !price || !location || !duration || !tourType || !destination) {
    return res.status(400).send('Missing required fields.');
  }

  // Kiểm tra giá và thời gian hợp lệ
  if (price <= 0 || duration < 1) {
    return res.status(400).send('Invalid price or duration.');
  }

  const specialAdultPrice = price * SPECIAL_DAY_MULTIPLIER;
  const childPrice = price * CHILD_MULTIPLIER;
  const specialChildPrice = childPrice * SPECIAL_DAY_MULTIPLIER;

  // Xử lý lịch trình (schedules)
  const tourSchedules = [];
  for (let i = 0; i < duration; i++) {
    const activity = (schedules && schedules[i]) || `Ngày ${i + 1}: Mô tả hoạt động cho ngày ${i + 1}`;

    tourSchedules.push({
      day: i + 1,
      activity: activity,
    });
  }

  try {
    // Log để kiểm tra ID tour và partner ID
    console.log("tourID:", tourID); // Correct the variable name
    console.log("partnerId:", partnerId);

    // Tìm và cập nhật tour nếu tồn tại và thuộc về partner
    const updatedTour = await Tour.findOneAndUpdate(
      { _id: tourID, partner: partnerId },  // Kiểm tra ID và partner
      {
        title,
        description,
        price,
        location,
        duration,
        partner: partnerId,
        tourType,
        destination,
        isDisabled: isDisabled ? true : false,
        specialAdultPrice,
        childPrice,
        specialChildPrice,
        schedules: tourSchedules, // Cập nhật lịch trình  
      },
      { new: true } // Trả về document đã cập nhật
    );

    // Nếu không tìm thấy tour hoặc không thuộc partner này
    if (!updatedTour) {
      console.log("Tour not found or not owned by this partner.");
      return res.status(404).send('Tour not found or you are not authorized to update this tour.');
    }

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
    const tour = await Tour.findById(tourID);
    if (!tour) {
      return res.status(404).send('Tour not found.'); 
    }

    tour.isDeleted = true;
    tour.deletionRequested = true;
    await tour.save();

    res.render('Tours/Partner/requestTour', { tour });
  } catch (error) {
    console.error('Error requesting deletion:', error);
    res.status(500).send('Error requesting deletion');
  }
};

// Bật/tắt trạng thái tour
const toggleTourStatus = async (req, res) => {
  const tourID = req.params.id;
  try {
    const tour = await Tour.findById(tourID);
    if (!tour) {
      return res.status(404).send('Tour not found.');
    }

    if (tour.partner.toString() !== req.user._id.toString()) {
      return res.status(403).send('You are not authorized to change this tour\'s status.');
    }

    tour.isDisabled = !tour.isDisabled;
    await tour.save();

    res.redirect('/partner/tours/list');
  } catch (error) {
    console.error('Error toggling tour status:', error);
    res.status(500).send('Error toggling tour status');
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
