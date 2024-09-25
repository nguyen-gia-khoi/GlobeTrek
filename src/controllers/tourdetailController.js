const mongoose = require('mongoose');
const TourDetail = require('../models/TourDetail');
const Destination = require('../models/Destination');
const Partner = require('../models/Partner');
const Tour = require('../models/Tour');

const { storage } = require('../Middleware/cloudinary');

// GET: Display the create tour detail page and fetch required data
const getCreateTourDetail = async (req, res) => {
  try {
    const tourDetails = await TourDetail.find({})
      .populate('tourID')
      .populate('destination')
      .populate('partner').sort({ createdAt: -1 });

    const destinations = await Destination.find({});
    const partners = await Partner.find({});
    const tours = await Tour.find({});

    res.render('TourDetail/create_tourdetail.ejs', {
      listTourDetail: tourDetails,
      destinations,
      partners,
      tours,
    });
  } catch (error) {
    console.error("Error fetching data:", error);
    res.status(500).send("Error fetching data");
  }
};

const postCreateTourDetail = async (req, res) => {
  const { tourID, tourDuration, norPrice, destination, partner, address, description, state } = req.body;

  // Validate numeric fields
  if (tourDuration < 1 || norPrice < 0) {
    return res.status(400).send('Invalid input: Duration must be at least 1 day and Price must be non-negative.');
  }

  // Get image and video paths from Cloudinary
  const images = req.files['images'] ? req.files['images'].map(file => file.path) : [];
  const videos = req.files['videos'] ? req.files['videos'].map(file => file.path) : [];

  try {
    await TourDetail.create({
      tourID,
      tourDuration,
      norPrice,
      address, // Add the new field here
      destination,
      partner,
      images, // Save images from Cloudinary
      videos, // Save videos from Cloudinary
      description,
      state,
    });

    res.redirect('/create_tour_detail');
  } catch (error) {
    console.error("Error creating tour detail:", error);
    res.status(500).send("Error creating tour detail");
  }
};

// GET: Display the edit tour detail page
const getUpdateTourDetail = async (req, res) => {
  try {
    const tourDetailID = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(tourDetailID)) {
      return res.status(400).send("Invalid tourDetailID");
    }

    const tourDetailEdit = await TourDetail.findById(tourDetailID)
      .populate('tourID')
      .populate('destination')
      .populate('partner');

    const destinations = await Destination.find({});
    const partners = await Partner.find({});
    const tours = await Tour.find({});

    res.render('TourDetail/edit_tour_detail.ejs', {
      tourDetailEdit,
      destinations,
      partners,
      tours,
    });
  } catch (error) {
    console.error("Error fetching tour detail for editing:", error);
    res.status(500).send("Error fetching data");
  }
};

const postUpdateTourDetail = async (req, res) => {
  const { tourDetailID, tourID, tourDuration, norPrice, destination, partner, address, description, state } = req.body;

  // Validate numeric fields
  if (tourDuration < 1 || norPrice < 0) {
    return res.status(400).send('Invalid input: Duration must be at least 1 day and Price must be non-negative.');
  }

  // Get image and video paths from Cloudinary
  const images = req.files['images'] ? req.files['images'].map(file => file.path) : [];
  const videos = req.files['videos'] ? req.files['videos'].map(file => file.path) : [];

  try {
    const result = await TourDetail.findByIdAndUpdate(
      tourDetailID,
      {
        tourID,
        tourDuration,
        norPrice,
        address, // Add the new field here
        destination,
        partner,
        images, // Update images from Cloudinary
        videos, // Update videos from Cloudinary
        description,
        state,
      },
      { new: true }
    );

    if (!result) {
      return res.status(404).send('Tour detail not found');
    }

    res.redirect('/create_tour_detail');
  } catch (error) {
    console.error("Error updating tour detail:", error);
    res.status(500).send("Error updating tour detail");
  }
};


// GET: Show delete confirmation for tour detail
const postDeleteTourDetail = async (req, res) => {
  const tourDetailID = req.params.id;

  try {
    if (!mongoose.Types.ObjectId.isValid(tourDetailID)) {
      return res.status(400).send("Invalid tourDetailID");
    }

    const tourDetail = await TourDetail.findById(tourDetailID).exec();

    if (!tourDetail) {
      return res.status(404).send("Tour detail not found");
    }

    res.render('TourDetail/delete_tour_detail.ejs', { tourDetailEdit: tourDetail });
  } catch (error) {
    console.error("Error fetching tour detail for deletion:", error);
    res.status(500).send("Error fetching data");
  }
};

// POST: Handle the actual deletion of tour detail
const postHandleRemoveTourDetail = async (req, res) => {
  const tourDetailID = req.body.tourDetailId;

  try {
    if (!mongoose.Types.ObjectId.isValid(tourDetailID)) {
      return res.status(400).send("Invalid tourDetailID");
    }

    const result = await TourDetail.deleteOne({ _id: tourDetailID });

    if (result.deletedCount === 0) {
      return res.status(404).send("Tour detail not found");
    }

    res.redirect('/create_tour_detail');
  } catch (error) {
    console.error("Error deleting tour detail:", error);
    res.status(500).send("Error deleting tour detail");
  }
};
//////////////////////////////////////////////////

// GET: Fetch all tour details
const getTourDetailsAPI = async (req, res) => {
  try {
    const tourDetails = await TourDetail.find({})
      .populate('tourID')
      .populate('destination')
      .populate('partner');

    res.status(200).json(tourDetails);
  } catch (error) {
    console.error("Error fetching tour details:", error);
    res.status(500).json({ message: "Error fetching tour details" });
  }
};


module.exports = {
  getCreateTourDetail,
  postCreateTourDetail,
  getUpdateTourDetail,
  postUpdateTourDetail,
  postDeleteTourDetail,
  postHandleRemoveTourDetail,
  getTourDetailsAPI,
};
