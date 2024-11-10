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

// Schema cho Tour
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
    min: [0, 'Price must be a positive number'],
  },
  specialAdultPrice: {
    type: Number,
    min: [0, 'Price must be a positive number'],
  },
  childPrice: {
    type: Number,
    required: [true, 'Child price is required'],
    min: [0, 'Price must be a positive number'],
  },
  specialChildPrice: {
    type: Number,
    min: [0, 'Price must be a positive number'],
  },
  location: {
    type: String,
    required: [true, 'Location is required'],
  },
  duration: {
    type: Number, // Duration là số ngày của tour
    required: true,
  },
  partner: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
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
    required: true 
  },
  destination: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Destination', 
    required: true 
  },
  images: { 
    type: [String], 
    default: [] 
  },
  videos: { 
    type: [String], 
    default: [] 
  },

  schedules: [
    {
      day: { 
        type: Number, 
        required: true 
      },
      activity: { 
        type: String, 
        required: true 
      }
    }
  ],
  availabilities: [
    {
      date: { 
        type: Date, 
        required: true, 
      },
      availableSeats: { 
        type: Number, 
        required: true, 
        min: [0, 'Available seats must be a positive number'] 
      } 
    }
  ]
}, { timestamps: true });


tourSchema.pre('save', function (next) {
  if (this.isModified('duration') && this.duration > 0) {
    if (!this.schedules || this.schedules.length === 0) {  // Chỉ tạo mới lịch trình nếu chưa có lịch trình
      const schedules = [];
      for (let i = 1; i <= this.duration; i++) {
        const description = this.schedules && this.schedules[i - 1] && this.schedules[i - 1].description
                            ? this.schedules[i - 1].description 
                            : `Ngày ${i}: Mô tả hoạt động trong ngày ${i}`; 
        schedules.push({
          day: i,
          activity: description,  // Đảm bảo sử dụng tên trường trong schema
        });
      }
      this.schedules = schedules;
    }
  }
  next();
});

tourSchema.methods.addAvailabilityForNext30Days = function(availableSeats) {
  const tour = this;
  const today = moment(); 

  const availabilities = [];
  for (let i = 0; i < 30; i++) {
    const nextDay = today.clone().add(i, 'days'); 
    const dateString = nextDay.format('YYYY-MM-DD'); 

    availabilities.push({
      date: dateString,
      availableSeats: availableSeats, 
    });
  }


  tour.availabilities = [...tour.availabilities, ...availabilities];
  
  return tour.save();
};


tourSchema.methods.createTourWithAvailability = async function(tourData, availableSeats) {

  const newTour = new this(tourData);
  await newTour.addAvailabilityForNext30Days(availableSeats); 
  return newTour.save();
};

module.exports = {
  Tour: mongoose.model('Tour', tourSchema),
  TourType: mongoose.model('TourType', tourTypeSchema),
  Destination: mongoose.model('Destination', destinationSchema),
};
