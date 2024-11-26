const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { Tour, TourType, Destination } = require('../../models/Tour');
const cloudinary = require('cloudinary').v2;
const { storage } = require('../../Middleware/cloudinary');
const multer = require('multer');
const upload = multer({ storage });
const moment = require('moment');
const Order  = require('../../models/Order')


// const [autoAvailability, customAvailability, createTourWithAvailability] = require('../../Middleware/availabilityMiddleware');

const SPECIAL_DAY_MULTIPLIER = 1.5;
const CHILD_MULTIPLIER = 0.75;

// Get userId from the token
const getUserIdFromToken = (PartneraccessToken) => {
  try {
    const decoded = jwt.verify(PartneraccessToken, process.env.ACCESS_TOKEN_SECRET);
    return decoded.userId;
  } catch (error) {
    console.error('Token không hợp lệ:', error);
    return null;
  }
};

// Get list of tours for a partner
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

// Get create tour page
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
    schedules, 
    totalSpots, 
    customAvailabilities, 
    availabilityType 
  } = req.body;

  try {
    // Get partnerId from token
    const token = req.cookies.PartneraccessToken;
    const partnerId = getUserIdFromToken(token);

    // Validate required fields
    if (!title || !description || !price || !location || !duration || !tourType || !destination || !totalSpots) {
      return res.status(400).send('Các trường bắt buộc chưa được điền.');
    }

    // Validate values
    if (price <= 0 || duration < 1 || totalSpots < 1) {
      return res.status(400).send('Thông tin không hợp lệ. Kiểm tra lại giá, thời gian và số chỗ ngồi.');
    }

    // Handle images and videos (if any)
    const images = req.files?.['images']?.map(file => file.path) || [];
    const videos = req.files?.['videos']?.map(file => file.path) || [];

    // Special and child prices
    const specialAdultPrice = price * SPECIAL_DAY_MULTIPLIER;
    const childPrice = price * CHILD_MULTIPLIER;
    const specialChildPrice = childPrice * SPECIAL_DAY_MULTIPLIER;

    // Handle schedules
    const tourSchedules = [];
    for (let i = 1; i <= duration; i++) {
      const activity = (schedules && schedules[i]) || `Ngày ${i + 1}: Mô tả hoạt động cho ngày ${i + 1}`;
      tourSchedules.push({
        day: i + 1,
        activity: activity,
      });
    }
    let availabilityData = [];

    if (availabilityType === 'auto') {
      const endOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);
      const totalDays = Math.ceil((endOfMonth - new Date()) / (1000 * 3600 * 24)); 
      
      let nextDate = new Date();  
    
      for (let i = 1; i < totalDays; i++) {
        const formattedDate = nextDate.toISOString().split('T')[0]; 
        const availableSeats = Number(totalSpots);
    
        availabilityData.push({
          date: formattedDate, 
          availableSeats: availableSeats,
        });

        let durationValue = Number(duration);
        console.log("Ngày ban đầu:", nextDate.toISOString().split('T')[0]);
        console.log("Duration value:", durationValue);
        nextDate.setDate(nextDate.getDate() + durationValue); 
        

        if (nextDate > endOfMonth) break; 
        console.log("Ngày sau khi cộng duration:", nextDate.toISOString().split('T')[0]);
      }
    } 
    else if (availabilityType === 'custom' && Array.isArray(customAvailabilities) && customAvailabilities.length) {
      availabilityData = customAvailabilities.map(date => ({
        date: new Date(date),
        availableSeats: totalSpots,
      }));
    } else {
      return res.status(400).send('Loại availability không hợp lệ (auto/custom).');
    }

    // Create and save the tour to DB
    const newTour = await Tour.create({
      title,
      description,
      price,
      location,
      duration,
      partner: partnerId,
      tourType,
      destination,
      isDisabled: req.body.isDisabled || false,
      specialAdultPrice,
      childPrice,
      specialChildPrice,
      images,
      videos,
      isApproved: false, // Needs admin approval
      schedules: tourSchedules,
      availabilities: availabilityData,
    });

    res.redirect('/partner/tours/list');
  } catch (error) {
    console.error('Lỗi khi tạo tour:', error);
    res.status(500).send('Có lỗi xảy ra khi tạo tour.');
  }
};



// Get update tour page
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

// Post update tour
const postUpdateTour = async (req, res) => {
  const { title, description, price, location, duration, tourType, destination, schedules, isDisabled } = req.body;
  const token = req.cookies.PartneraccessToken;
  const partnerId = getUserIdFromToken(token);
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

  const specialAdultPrice = price * SPECIAL_DAY_MULTIPLIER;
  const childPrice = price * CHILD_MULTIPLIER;
  const specialChildPrice = childPrice * SPECIAL_DAY_MULTIPLIER;

  // Handle schedules
  const tourSchedules = [];
  for (let i = 1; i <= duration; i++) {
    const activity = (schedules && schedules[i]) || `Ngày ${i + 1}: Mô tả hoạt  cho ngày ${i + 1}`;
    tourSchedules.push({
      day: i + 1,
      activity: activity,
    });
  }

  try {
    const updatedTour = await Tour.findOneAndUpdate(
      { _id: tourID, partner: partnerId },
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
        schedules: tourSchedules,
      },
      { new: true }
    );

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
    // Tìm tour theo ID
    const tour = await Tour.findById(tourID);
    if (!tour) {
      return res.status(404).send('Tour not found.'); 
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
