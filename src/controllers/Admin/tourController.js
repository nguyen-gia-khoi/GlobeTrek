const mongoose = require('mongoose');
const { Tour, TourType, Destination } = require('../models/Tour');
const cloudinary = require('cloudinary').v2;
const { storage } = require('../Middleware/cloudinary');
const multer = require('multer');
const upload = multer({ storage });


const SPECIAL_DAY_MULTIPLIER = 1.5; // Hệ số cho ngày đặc biệt
const CHILD_MULTIPLIER = 0.75;      // Hệ số cho trẻ em

// GET: Display form for creating a new tour
const getCreateTour = async (req, res) => {
    try {
      const tourTypes = await TourType.find({});
      const destinations = await Destination.find({});
  
      res.render('Tours/create', { tourTypes, destinations });
    } catch (error) {
      console.error('Error fetching data for creating tour:', error);
      res.status(500).send('Error fetching data');
    }
  };
  
  // POST: Create a new tour
  const postCreateTour = async (req, res) => {
    const { title, description, price, location, duration, contact, availableSpots, tourType, destination } = req.body;
    const isDisabled = req.body.isDisabled ? true : false;
    // Validate numeric fields
    if (duration < 1 || price < 0 || availableSpots < 0) {
      return res.status(400).send('Invalid input: Duration must be at least 1 day, and Price/Available Spots must be non-negative.');
    }
  
    
    // Tính toán giá đặc biệt và giá trẻ em dựa trên hệ số cố định
    const specialAdultPrice = price * SPECIAL_DAY_MULTIPLIER;
    const childPrice = price * CHILD_MULTIPLIER;
    const specialChildPrice = childPrice * SPECIAL_DAY_MULTIPLIER;
  
  
  
    // Get image paths from Cloudinary
    const images = req.files['images'] ? req.files['images'].map(file => file.path) : [];
    const videos = req.files['videos'] ? req.files['videos'].map(file => file.path) : [];
  
    try {
      // Create a new tour
      const newTour = await Tour.create({
        title,
        description,
        price,
        specialAdultPrice,
        childPrice,
        specialChildPrice,
        location,
        duration,
        contact,
        availableSpots,
        tourType,
        destination,
        isDisabled,
        images, 
        videos, 
  
  
    
      });
  // Cập nhật trường tours trong Destination
  await Destination.findByIdAndUpdate(destination, { $addToSet: { tours: newTour._id } }); // Thêm tour vào danh sách tours
  
      // Redirect to the list of tours or another appropriate page
      res.redirect('/tours');
    } catch (error) {
      console.error('Error creating tour:', error);
      res.status(500).send('Error creating tour');
    }
  };
  
  
  // GET: Display form for editing a tour
  const getUpdateTour = async (req, res) => {
    try {
      const tour = await Tour.findById(req.params.id).populate('tourType').populate('destination');
      const tourTypes = await TourType.find({});
      const destinations = await Destination.find({});
  
      res.render('Tours/edit', { tour, tourTypes, destinations });
    } catch (error) {
      console.error('Error fetching tour for editing:', error);
      res.status(500).send('Error fetching tour');
    }
  };
  
  
  // POST: Update an existing tour
  const postUpdateTour = async (req, res) => {
    const { title, description, price, location, duration, contact, availableSpots, tourType, destination } = req.body;
    const tourID = req.params.id;
    const isDisabled = req.body.isDisabled ? true : false;
  
    // Validate numeric fields
    if (duration < 1 || price < 0 || availableSpots < 0) {
      return res.status(400).send('Invalid input: Duration must be at least 1 day, and Price/Available Spots must be non-negative.');
    }
  
     // Tính toán giá đặc biệt và giá trẻ em dựa trên hệ số cố định
     const specialAdultPrice = price * SPECIAL_DAY_MULTIPLIER;
     const childPrice = price * CHILD_MULTIPLIER;
     const specialChildPrice = childPrice * SPECIAL_DAY_MULTIPLIER;
    // Get image and video paths from Cloudinary if they were uploaded
    const images = req.files['images'] ? req.files['images'].map(file => file.path) : [];
    const videos = req.files['videos'] ? req.files['videos'].map(file => file.path) : [];
  
    try {
      const updatedTour = {
        title,
        description,
        price,
        specialAdultPrice,
        childPrice,
        specialChildPrice,
        location,
        duration,
        contact,
        availableSpots,
        tourType,
        destination,
        isDisabled,
      };
  
      // If new images were uploaded, merge them with existing images
      if (images.length > 0) {
        updatedTour.images = [...images]; // Cập nhật trường images với hình ảnh mới
      }
  
      // If new videos were uploaded, merge them with existing videos
      if (videos.length > 0) {
        updatedTour.videos = [...videos]; // Cập nhật trường videos với video mới
      }
  
      // Cập nhật tour
      await Tour.findByIdAndUpdate(tourID, updatedTour);
      res.redirect('/Tours');
    } catch (error) {
      console.error('Error updating tour:', error);
      res.status(500).send('Error updating tour');
    }
  };
  
  // GET: Confirm deletion of a tour
  const getDeleteTour = async (req, res) => {
    try {
      const tour = await Tour.findById(req.params.id);
      res.render('Tours/delete', { tour });
    } catch (error) {
      console.error('Error fetching tour for deletion:', error);
      res.status(500).send('Error fetching tour');
    }
  };
  
  // POST: Delete a tour
  const postDeleteTour = async (req, res) => {
    try {
      await Tour.findByIdAndDelete(req.params.id);
      res.redirect('/Tours');
    } catch (error) {
      console.error('Error deleting tour:', error);
      res.status(500).send('Error deleting tour');
    }
  };
  
  // POST: Toggle schedule status
  const toggleScheduleStatus = async (req, res) => {
    try {
      const { tourID, scheduleIndex } = req.body;
  
      const tour = await Tour.findById(tourID);
      if (!tour) return res.status(404).send('Tour not found');
  
      tour.schedules[scheduleIndex].isActive = !tour.schedules[scheduleIndex].isActive;
      await tour.save();
  
      res.redirect(`/tours/${tourID}/edit`);
    } catch (error) {
      console.error('Error toggling schedule status:', error);
      res.status(500).send('Error toggling schedule status');
    }
  };
  
  module.exports = {
    getCreateTour,
    postCreateTour,
    getUpdateTour,
    postUpdateTour,
    getDeleteTour,
    postDeleteTour,
    toggleScheduleStatus,
  };