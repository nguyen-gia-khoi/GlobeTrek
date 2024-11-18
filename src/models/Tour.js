const mongoose = require('mongoose');
const moment = require('moment');

// Schema cho TourType
const tourTypeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Tour type name is required'],
    unique: true, // Đảm bảo không có tên trùng lặp
  },
});

// Schema cho Destination
const destinationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Destination name is required'],
    unique: true, // Đảm bảo không có tên trùng lặp
  },
  tours: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Tour' }],
});
////
const tourSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Tour title is required'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Tour description is required'],
      trim: true,
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [10000, 'Price must be a positive number'],
    },
    specialAdultPrice: {
      type: Number,
      min: [0, 'Special price must be a positive number'],
    },
    childPrice: {
      type: Number,
      min: [0, 'Child price must be a positive number'],
    },
    specialChildPrice: {
      type: Number,
      min: [0, 'Special child price must be a positive number'],
    },
    location: {
      type: String,
      required: [true, 'Location is required'],
      trim: true,
    },
    duration: {
      type: Number, // Số ngày của tour
      required: true,
      min: 1,
    },
    partner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isDisabled: {
      type: Boolean,
      default: false,
    },
    isApproved: {
      type: Boolean,
      default: false,
    },
    isDeleted: { 
      type: Boolean, 
      default: false 
    },
    deletionRequested: { 
      type: Boolean, 
      default: false 
    },
    tourType: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TourType',
      required: true,
    },
    destination: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Destination',
      required: true,
    },
    images: {
      type: [String],
      default: [],
    },
    videos: {
      type: [String],
      default: [],
    },
    schedules: [
      {
        day: { type: Number, required: true },
        activity: { type: String, required: true },
      },
    ],
    availabilities: [
      {
        date: { type: Date, required: true },
        availableSeats: { type: Number, required: true, min: 0 },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Tour', tourSchema);


module.exports = {
  Tour: mongoose.model('Tour', tourSchema),
  TourType: mongoose.model('TourType', tourTypeSchema),
  Destination: mongoose.model('Destination', destinationSchema),
};
