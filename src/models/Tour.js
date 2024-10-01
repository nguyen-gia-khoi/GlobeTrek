const mongoose = require('mongoose');

// Schema for each scheduled tour
const scheduleSchema = new mongoose.Schema({
  startDate: {
    type: Date,
    required: true,
  },
  endDate: {
    type: Date,
    required: true,
  },
  isActive: {
    type: Boolean,
    default: true, // Allows enabling/disabling of the schedule
  },
  itinerary: [
    {
      time: {
        type: String,
        required: true,
      },
      activity: {
        type: String,
        required: true,
      },
      location: {
        type: String, // Optional: Where the activity takes place
      },
    },
  ],
});

// Main tour schema
const tourSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Tour title is required'],
  },
  description: {
    type: String,
    required: [true, 'Tour description is required'],
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
  },
  location: {
    type: String,
    required: [true, 'Location is required'],
  },
  duration: {
    type: String,
    required: true,
  },
  contact: {
    type: String,
    required: true,
  },
  availableSpots: {
    type: Number,
    required: true,
    default: 0, // Fixed number of available spots
  },
  isDisabled: {
    type: Boolean,
    default: false, // Enables manual disabling of the tour
  },
  schedules: [scheduleSchema], // Array of schedules
}, { timestamps: true });

module.exports = mongoose.model('Tour', tourSchema);
