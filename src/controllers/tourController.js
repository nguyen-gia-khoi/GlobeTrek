const mongoose = require('mongoose');
const { Tour, TourType, Destination } = require('../models/Tour');
const multer = require('multer');

// GET: Display list of all tours
const getTours = async (req, res) => {
  try {
    const tours = await Tour.find()
      .populate('tourType')
      .populate('destination')
      .sort({ createdAt: -1 });

    res.render('Tours/list', { tours });
  } catch (error) {
    console.error('Error fetching tours:', error);
    res.status(500).send('Error fetching tours');
  }
};

// API: Get all tours in JSON format
const getToursAPI = async (req, res) => {
  try {
    const tours = await Tour.find()
      .populate('tourType')
      .populate('destination')
      .sort({ createdAt: -1 });

    res.json(tours);
  } catch (error) {
    console.error('Error fetching tours:', error);
    res.status(500).json({ error: 'Error fetching tours' });
  }
};
//api get id tour
const getTourById = async (req, res) => {
  try {
    const tour = await Tour.findById(req.params.id)
      .populate('tourType')
      .populate('destination');

    if (!tour) {
      return res.status(404).json({ error: 'Tour not found' });
    }

    res.json(tour);
  } catch (error) {
    console.error('Error fetching tour by ID:', error);
    res.status(500).json({ error: 'Error fetching tour' });
  }
};

module.exports = {
  getTours,
  getToursAPI,
  getTourById,
};
