
const mongoose = require('mongoose');

const Tour = require("../models/Tour");
const TourType = require("../models/TourType");

const { getUpdateTourType } = require("./homeController");

// Get all tours and render the create tour page

const getCreateTour = async (req, res) => {
  try {
    console.log("Fetching tours...");
    let tours = await Tour.find({}).populate('tourtype').sort({ createdAt : -1});
    console.log("Tours fetched:", tours);

    console.log("Fetching tour types...");
    let tourTypes = await TourType.find({});
    console.log("Tour types fetched:", tourTypes);

    res.render('Tour/create_tour.ejs', { listTour: tours, tourTypes: tourTypes });
  } catch (error) {
    console.error("Error fetching tours or tour types:", error);
    res.status(500).send("Error fetching data");
  }
};



// Create a new tour
const postCreateTour = async (req, res) => {
  let { TourName, TourType } = req.body;
  console.log(">>>>> TourName= ", TourName, "TourType =", TourType);

  try {
    await Tour.create({
      tourname: TourName,
      tourtype: TourType  // Assuming TourType is an ObjectId reference
    });
    res.redirect('/create_tour');
  } catch (error) {
    console.error("Error creating tour:", error);
    res.status(500).send("Error creating tour");
  }
};

// Render the update tour page

const getUpdateTour = async (req, res) => {
  try {
    console.log(">>>> req.param: ", req.params);
    const TourID = req.params.id; // Get the ID from the request parameters
    let tourEdit = await Tour.findById(TourID).populate('tourtype').exec(); // Fetch the specific tour by ID and populate the tour type
    let tourTypes = await TourType.find({}); // Fetch all tour types for the dropdown

    // Pass the tour to edit and the tour types to the EJS template
    res.render('Tour/edit_tour.ejs', { tourEdit: tourEdit, tourTypes: tourTypes });
  } catch (error) {
    console.error("Error fetching tour for editing:", error);
    res.status(500).send("Error fetching data");
  }
};

const postUpdateTour = async (req, res) => {
  const { TourName, TourType, TourId } = req.body;

  // Log the request body to see if it's correctly populated
  console.log("Request body:", req.body);

  try {
    // Check if the TourId is a valid ObjectId before proceeding
    if (!mongoose.Types.ObjectId.isValid(TourId)) {
      throw new Error("Invalid TourId");
    }

    // Attempt to update the tour in the database
    const result = await Tour.updateOne(
      { _id: TourId },
      {
        tourname: TourName,
        tourtype: TourType
      }
    );

    // Log the result of the update operation
    console.log("Update Result:", result);

    // Check if the update operation affected any document
    if (result.nModified === 0) {
      console.error("No tour was updated. Please check the TourId.");
      return res.status(404).send("Tour not found or no changes detected.");
    }

    // Redirect after a successful update
    res.redirect('/create_tour');
  } catch (error) {
    console.error("Error updating tour:", error.message);
    res.status(500).send("Error updating tour: " + error.message);
  }
};

const postDeleteTour = async (req, res) => {
  const TourID = req.params.id;

  try {
    // Fetch the tour by ID
    let tour = await Tour.findById(TourID).exec();

    // Render the delete confirmation page
    res.render('Tour/delete_tour.ejs', { tourEdit: tour });
  } catch (error) {
    console.error("Error fetching tour for deletion:", error.message);
    res.status(500).send("Error fetching tour: " + error.message);
  }
};
const postHandleRemoveTour = async (req, res) => {
  const tourID = req.body.tourId;

  try {
    // Delete the tour by ID
    await Tour.deleteOne({ _id: tourID });

    console.log("Tour has been deleted");
    res.redirect('/create_tour'); // Redirect after deletion
  } catch (error) {
    console.error("Error deleting tour:", error.message);
    res.status(500).send("Error deleting tour: " + error.message);
  }
};

///////////////////////////////////// <<<<API ONLY>>>>


const getToursAPI = async (req, res) => {
  try {
      // Fetch all tours and populate the associated tour types
      const tours = await Tour.find({}).populate('tourtype').sort({ createdAt : -1 });
      
      // Return a successful response with both tours and tour types
      return res.status(200).json({
          errorCode: 0,
          message: 'Tours fetched successfully',
          data: {
              tours
          }
      });
  } catch (error) {
      // Handle any errors that occur during the process
      return res.status(500).json({
          errorCode: 1,
          message: 'An error occurred while fetching tours',
          error: error.message
      });
  }
};

module.exports = { getCreateTour, 
                   postCreateTour, 
                   getUpdateTour,
                   postUpdateTour,
                   getToursAPI,
                   postDeleteTour,
                   postHandleRemoveTour };
