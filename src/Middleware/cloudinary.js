const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { v2: cloudinary } = require('cloudinary');

// Cấu hình Cloudinary
cloudinary.config({
  cloud_name: 'dnapzxvmr', // Thay bằng cloud_name của bạn
  api_key: '493981653537236', // Thay bằng API key của bạn
  api_secret: 'DRf-iDR83p1jRBoMidEITEBjeOQ' // Thay bằng API secret của bạn
});

// Cấu hình lưu trữ trên Cloudinary
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'tourDetails', // Thư mục trên Cloudinary
    allowed_formats: ['jpg', 'png', 'mp4'], // Các định dạng cho phép
    resource_type: 'auto', // Để có thể tải cả ảnh và video
  },
});

// Khởi tạo Multer với Cloudinary storage
const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const fileTypes = /jpeg|jpg|png|gif|mp4|avi/;
    const extname = fileTypes.test(file.originalname.toLowerCase());
    const mimeType = fileTypes.test(file.mimetype);

    if (extname && mimeType) {
      return cb(null, true);
    } else {
      cb('Error: Invalid file type');
    }
  }
});

// Middleware để upload nhiều file (hình ảnh và video)
const uploadMultiple = upload.fields([
  { name: 'images', maxCount: 10 },
  { name: 'videos', maxCount: 5 }
]);

module.exports = { uploadMultiple };
