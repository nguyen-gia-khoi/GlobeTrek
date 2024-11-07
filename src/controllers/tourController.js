const mongoose = require('mongoose');
const { Tour, TourType, Destination } = require('../models/Tour');

// GET: list of all tours (dành cho user)
const getTours = async (req, res) => {
  try {
    const tours = await Tour.find({ isApproved: true }) // Chỉ lấy tour đã được phê duyệt
      .populate('tourType')
      .populate('destination')
      .sort({ createdAt: -1 });

    res.render('Tours/list', { tours });
  } catch (error) {
    console.error('Error fetching tours:', error);
    res.status(500).send('Error fetching tours');
  }
};

// API: Get all tours  (dành cho user)
const getToursAPI = async (req, res) => {
  try {
    const tours = await Tour.find({ isApproved: true }) 
      .populate('destination')
      .sort({ createdAt: -1 });

    res.json(tours);
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

    res.json(tour);
  } catch (error) {
    console.error('Error fetching tour by ID:', error);
    res.status(500).json({ error: 'Error fetching tour' });
  }
};

// API: Search tours by title (dành cho user)
const searchTours = async (req, res) => {
  const { query } = req.query;
  try {
    const tours = await Tour.find({ 
      title: { $regex: query, $options: 'i' },
      isApproved: true 
    });

    res.status(200).json(tours);
  } catch (error) {
    res.status(500).json({ message: 'Không thể tìm kiếm tour', error });
  }
};

module.exports = {
  getTours,
  getToursAPI,
  getTourById,
  searchTours
};
