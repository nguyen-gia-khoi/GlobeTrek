const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { Tour, TourType, Destination } = require('../../models/Tour');
const cloudinary = require('cloudinary').v2;
const { storage } = require('../../Middleware/cloudinary');
const multer = require('multer');
const upload = multer({ storage });

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
    const tours = await Tour.find({ partner: partnerId })
      .populate('tourType')
      .populate('destination');
      
    if (!tours || tours.length === 0) {
      return res.render('Tours/Partner/list', { message: 'Không có tour nào.' });
    }
    
    res.render('Tours/Partner/list', { tours });
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
  const { title, description, price, location, duration, availableSpots, tourType, destination } = req.body;
  const token = req.cookies.PartneraccessToken;
  const partnerId = getUserIdFromToken(token);
  const isDisabled = req.body.isDisabled ? true : false;

  if (duration < 1 || price < 0 || availableSpots < 0) {
    return res.status(400).send('Invalid input: Duration must be at least 1 day, and Price/Available Spots must be non-negative.');
  }

  const specialAdultPrice = price * SPECIAL_DAY_MULTIPLIER;
  const childPrice = price * CHILD_MULTIPLIER;
  const specialChildPrice = childPrice * SPECIAL_DAY_MULTIPLIER;

  const images = req.files?.['images'] ? req.files['images'].map(file => file.path) : [];
  const videos = req.files?.['videos'] ? req.files['videos'].map(file => file.path) : [];

  try {
    const newTour = await Tour.create({
      title,
      description,
      price,
      specialAdultPrice,
      childPrice,
      specialChildPrice,
      location,
      duration,
      availableSpots,
      partner: partnerId,
      tourType,
      destination,
      isDisabled,
      isApproved: false, // Mặc định là chưa được phê duyệt
      images,
      videos,
    });

    res.redirect('/partner/tours/list');
  } catch (error) {
    console.error('Error creating tour:', error);
    res.status(500).send('Error creating tour');
  }
};


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

// Cập nhật tour
const postUpdateTour = async (req, res) => {
  const { title, description, price, location, duration, availableSpots, tourType, destination } = req.body;
  const tourID = req.params.id;
  const token = req.cookies.PartneraccessToken;
  const partnerId = getUserIdFromToken(token);

  if (duration < 1 || price < 0 || availableSpots < 0) {
    return res.status(400).send('Invalid input: Duration must be at least 1 day, and Price/Available Spots must be non-negative.');
  }

  // Tính toán giá cho người lớn đặc biệt, trẻ em, và trẻ em đặc biệt
  const specialAdultPrice = price * SPECIAL_DAY_MULTIPLIER;
  const childPrice = price * CHILD_MULTIPLIER;
  const specialChildPrice = childPrice * SPECIAL_DAY_MULTIPLIER;

  // Lưu trữ hình ảnh và video 
  const images = req.files?.['images'] ? req.files['images'].map(file => file.path) : [];
  const videos = req.files?.['videos'] ? req.files['videos'].map(file => file.path) : [];

  try {
    const tour = await Tour.findById(tourID);
    if (!tour) {
      return res.status(404).send('Tour not found.');
    }
    // Kiểm tra quyền truy cập của partner
    if (tour.partner.toString() !== partnerId.toString()) {
      return res.status(403).send('You are not authorized to update this tour.');
    }
    // Cập nhật thông tin tour
    tour.title = title;
    tour.description = description;
    tour.price = price;
    tour.specialAdultPrice = specialAdultPrice;
    tour.childPrice = childPrice;
    tour.specialChildPrice = specialChildPrice;
    tour.location = location;
    tour.duration = duration;
    tour.availableSpots = availableSpots;
    tour.tourType = tourType;
    tour.destination = destination;
    tour.partner = partnerId;
    tour.isDisabled = req.body.isDisabled ? true : false;

    if (images.length > 0) {
      tour.images = images;
    }
    if (videos.length > 0) {
      tour.videos = videos;
    }
    await tour.save();
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

    tour.isApproved = false; // Mặc định là chưa được phê duyệt
    tour.approvalRequested = true; // Đánh dấu yêu cầu phê duyệt
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
      return res.status(403).send('You are not authorized to change the status of this tour.');
    }

    // Thêm kiểm tra xem tour đã được phê duyệt chưa
    if (!tour.isApproved) {
      return res.status(403).send('You cannot change the status of an unapproved tour.');
    }

    tour.isDisabled = !tour.isDisabled; 
    await tour.save();
    res.render('Tours/Partner/requestTour', { tour });
  } catch (error) {
    console.error('Error toggling tour status:', error);
    res.status(500).send('Error toggling tour status');
  }
};

module.exports = {
  getTourList,
  getCreateTour,
  getUpdateTour,
  postCreateTour,
  postUpdateTour,
  requestApproval,
  requestDeleteTour,
  toggleTourStatus,
};


