const mongoose = require('mongoose');

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

// Schema cho mỗi lịch trình tour
const scheduleSchema = new mongoose.Schema({

  isActive: {
    type: Boolean,
    default: true,
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
        type: String,
      },
    },
  ],
});

// Schema chính cho Tour
const tourSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Tour title is required'],
  },
  description: {
    type: String,
    required: [true, 'Tour description is required'],
  },
  price: { // Giá người lớn
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price must be a positive number'],
  },
  specialAdultPrice: { // Giá ngày đặc biệt của người lớn
    type: Number,
    required: [true, 'Special adult price is required'],
    min: [0, 'Price must be a positive number'],
  },
  childPrice: { // Giá trẻ em
    type: Number,
    required: [true, 'Child price is required'],
    min: [0, 'Price must be a positive number'],
  },
  specialChildPrice: { // Giá ngày đặc biệt của trẻ em
    type: Number,
    required: [true, 'Special child price is required'],
    min: [0, 'Price must be a positive number'],
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
    default: 0,
    min: 0 
  },
  isDisabled: {
    type: Boolean,
    default: false,
  },
  schedules: [scheduleSchema],
  tourType: { type: mongoose.Schema.Types.ObjectId, ref: 'TourType', required: true }, // Mối quan hệ với tourType
  destination: { type: mongoose.Schema.Types.ObjectId, ref: 'Destination', required: true }, // Mối quan hệ với destination
  images: { type: [String], default: [] }, 
  videos: { type: [String], default: [] }, 
}, { timestamps: true });

module.exports = {
  Tour: mongoose.model('Tour', tourSchema),
  TourType: mongoose.model('TourType', tourTypeSchema),
  Destination: mongoose.model('Destination', destinationSchema),
};
