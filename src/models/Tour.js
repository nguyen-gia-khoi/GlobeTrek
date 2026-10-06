const mongoose = require('mongoose');
const moment = require('moment');

// Schema cho TourType
const tourTypeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Tour type name is required'],
      unique: true, // Đảm bảo không có tên trùng lặp
      trim: true,
      maxlength: [100, 'Tên loại tour không được vượt quá 100 ký tự'],
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: [500, 'Mô tả loại tour không được vượt quá 500 ký tự'],
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Schema cho Country (Quốc Gia)
const countrySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Tên quốc gia là bắt buộc'],
      unique: true,
      trim: true,
      maxlength: [100, 'Tên quốc gia không được vượt quá 100 ký tự'],
    },
    code: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: [10, 'Mã quốc gia không được vượt quá 10 ký tự'],
      default: '',
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: [500, 'Mô tả quốc gia không được vượt quá 500 ký tự'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Schema cho Region (Vùng Miền)
const regionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Tên vùng miền là bắt buộc'],
      trim: true,
      maxlength: [100, 'Tên vùng miền không được vượt quá 100 ký tự'],
    },
    country: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Country',
      required: [true, 'Quốc gia trực thuộc là bắt buộc'],
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: [500, 'Mô tả vùng miền không được vượt quá 500 ký tự'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Schema cho Destination (Điểm Đến)
const destinationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Destination name is required'],
      unique: true, // Đảm bảo không có tên trùng lặp
      trim: true,
      maxlength: [100, 'Tên điểm đến không được vượt quá 100 ký tự'],
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: [500, 'Mô tả điểm đến không được vượt quá 500 ký tự'],
    },
    country: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Country',
    },
    region: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Region',
    },
    image: {
      type: String,
      default: '',
      trim: true,
      maxlength: [1000, 'Đường dẫn ảnh không được vượt quá 1000 ký tự'],
    },
    isPopular: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    tours: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Tour' }],
  },
  { timestamps: true }
);
////
const tourSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Tour title is required'],
      trim: true,
      maxlength: [200, 'Tiêu đề tour không được vượt quá 200 ký tự'],
    },
    description: {
      type: String,
      required: [true, 'Tour description is required'],
      trim: true,
      maxlength: [3000, 'Mô tả tour không được vượt quá 3000 ký tự'],
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
    holidayAdultPercent: {
      type: Number,
      default: 150,
      min: [0, 'Tỷ lệ ngày lễ không được âm'],
    },
    holidayChildPercent: {
      type: Number,
      default: 150,
      min: [0, 'Tỷ lệ ngày lễ không được âm'],
    },
    childPercent: {
      type: Number,
      default: 75,
      min: [0, 'Tỷ lệ giá trẻ em không được âm'],
    },
    location: {
      type: String,
      required: [true, 'Location is required'],
      trim: true,
      maxlength: [200, 'Địa điểm không được vượt quá 200 ký tự'],
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
    country: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Country',
    },
    region: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Region',
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
  },
  { timestamps: true }
);

const Tour = mongoose.models.Tour || mongoose.model('Tour', tourSchema);
const TourType = mongoose.models.TourType || mongoose.model('TourType', tourTypeSchema);
const Country = mongoose.models.Country || mongoose.model('Country', countrySchema);
const Region = mongoose.models.Region || mongoose.model('Region', regionSchema);
const Destination = mongoose.models.Destination || mongoose.model('Destination', destinationSchema);

module.exports = {
  Tour,
  TourType,
  Destination,
  Country,
  Region,
};
