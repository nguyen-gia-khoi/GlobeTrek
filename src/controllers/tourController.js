const mongoose = require('mongoose');
const { Tour, TourType, Destination } = require('../models/Tour');
const cloudinary = require('cloudinary').v2;

// Middleware for handling Cloudinary uploads
const { storage } = require('../Middleware/cloudinary');
const multer = require('multer');
const upload = multer({ storage });

// GET: Display list of all tours
const getTours = async (req, res) => {
  try {
    const tours = await Tour.find()
      .populate('tourType')
      .populate('destination')
      .sort({ createdAt: -1 });

    res.render('tour/list', { tours });
  } catch (error) {
    console.error('Error fetching tours:', error);
    res.status(500).send('Error fetching tours');
  }
};

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

  try {
    const uploadedImage = await cloudinary.uploader.upload(req.file.path, { folder: 'tours' });

    const newTour = await Tour.create({
      title,
      description,
      price,
      location,
      duration,
      contact,
      availableSpots,
      tourType,
      destination,
      img: uploadedImage.secure_url,
    });

    res.redirect('/Tours/list');
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
  const { title, description, price, location, duration, contact, availableSpots, tourType, destination, isDisabled } = req.body;
  const tourID = req.params.id;

  try {
    const updatedTour = {
      title,
      description,
      price,
      location,
      duration,
      contact,
      availableSpots,
      tourType,
      destination,
      isDisabled: isDisabled === 'on', // Convert checkbox to boolean
    };

    // If a new image was uploaded
    if (req.file) {
      const uploadedImage = await cloudinary.uploader.upload(req.file.path, { folder: 'tours' });
      updatedTour.img = uploadedImage.secure_url;
    }

    await Tour.findByIdAndUpdate(tourID, updatedTour);
    res.redirect('/tours');
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
    res.redirect('/tours');
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
  getTours,
  getCreateTour,
  postCreateTour,
  getUpdateTour,
  postUpdateTour,
  getDeleteTour,
  postDeleteTour,
  toggleScheduleStatus,
};
