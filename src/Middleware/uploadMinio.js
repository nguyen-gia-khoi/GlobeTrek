const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const { uploadBufferToMinio } = require('../service/minioService');

// Multer memory storage (holds files in RAM for Sharp processing)
const storage = multer.memoryStorage();

// File filter for allowed image & video types
const fileFilter = (req, file, cb) => {
  const allowedImageTypes = /jpeg|jpg|png|webp|gif/;
  const allowedVideoTypes = /mp4|avi|mov|mkv|webm/;
  
  const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
  const isImage = allowedImageTypes.test(ext) || allowedImageTypes.test(file.mimetype);
  const isVideo = allowedVideoTypes.test(ext) || allowedVideoTypes.test(file.mimetype);

  if (isImage || isVideo) {
    cb(null, true);
  } else {
    cb(new Error(`Định dạng tệp không được hỗ trợ: ${file.originalname}`));
  }
};

// Initialize Multer
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max per file
  },
  fileFilter: fileFilter,
});

// Multer fields configuration for Tour (Multiple images & videos)
const multerFields = upload.fields([
  { name: 'images', maxCount: 10 },
  { name: 'videos', maxCount: 5 },
]);

/**
 * Helper: Smart image optimizer using Sharp
 * - Resizes image within maxWidth x maxHeight without enlargement
 * - Auto-orients EXIF rotation
 * - Converts to WebP with max compression effort (effort: 6)
 * - Smart comparison: guarantees the uploaded file is optimal in size
 */
const optimizeAndUploadImage = async (fileBuffer, originalName, originalMimeType, maxWidth, maxHeight, folder) => {
  try {
    const webpBuffer = await sharp(fileBuffer)
      .rotate()
      .resize({
        width: maxWidth,
        height: maxHeight,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({
        quality: 78,
        effort: 6,
      })
      .toBuffer();

    // If WebP is smaller or within 5% of original, prefer standard WebP
    if (webpBuffer.length <= fileBuffer.length) {
      const parsedName = path.parse(originalName).name;
      const webpFilename = `${parsedName}.webp`;
      return await uploadBufferToMinio(webpBuffer, webpFilename, 'image/webp', folder);
    } else {
      // For tiny pre-compressed JPGs, attempt quality 72 with effort 6
      const tighterWebp = await sharp(fileBuffer)
        .rotate()
        .resize({ width: maxWidth, height: maxHeight, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 72, effort: 6 })
        .toBuffer();

      if (tighterWebp.length <= fileBuffer.length) {
        const parsedName = path.parse(originalName).name;
        return await uploadBufferToMinio(tighterWebp, `${parsedName}.webp`, 'image/webp', folder);
      }

      // If original is still the smallest, upload original file
      return await uploadBufferToMinio(fileBuffer, originalName, originalMimeType || 'image/jpeg', folder);
    }
  } catch (err) {
    console.error(`[Sharp Error] Optimization failed for ${originalName}:`, err);
    return await uploadBufferToMinio(fileBuffer, originalName, originalMimeType || 'image/jpeg', folder);
  }
};

/**
 * Middleware: Process incoming tour images with Sharp (convert to WebP & resize),
 * then upload both images & videos to MinIO Object Storage.
 */
const uploadAndOptimizeTourMedia = (req, res, next) => {
  multerFields(req, res, async (err) => {
    if (err) {
      console.error('[Upload Error]', err);
      return res.status(400).send(`Lỗi tải tệp: ${err.message}`);
    }

    try {
      // 1. Process and optimize images with Sharp
      if (req.files && req.files['images'] && req.files['images'].length > 0) {
        const imagePromises = req.files['images'].map(async (file) => {
          const fileUrl = await optimizeAndUploadImage(
            file.buffer,
            file.originalname,
            file.mimetype,
            1920,
            1080,
            'tourDetails/images'
          );
          file.path = fileUrl;
          file.url = fileUrl;
        });

        await Promise.all(imagePromises);
      }

      // 2. Upload videos to MinIO without re-encoding
      if (req.files && req.files['videos'] && req.files['videos'].length > 0) {
        const videoPromises = req.files['videos'].map(async (file) => {
          const fileUrl = await uploadBufferToMinio(
            file.buffer,
            file.originalname,
            file.mimetype || 'video/mp4',
            'tourDetails/videos'
          );
          file.path = fileUrl;
          file.url = fileUrl;
        });

        await Promise.all(videoPromises);
      }

      next();
    } catch (uploadError) {
      console.error('[MinIO Upload Error]', uploadError);
      return res.status(500).send(`Lỗi lưu trữ MinIO: ${uploadError.message}`);
    }
  });
};

// Multer single file configuration for Destination / Avatar
const uploadSingleImageField = upload.single('image');

/**
 * Middleware: Process single image with Sharp (convert to WebP & resize)
 * and upload to MinIO.
 * @param {string} folder - Folder name in MinIO bucket
 */
const uploadAndOptimizeSingleImage = (folder = 'destinations') => (req, res, next) => {
  uploadSingleImageField(req, res, async (err) => {
    if (err) {
      console.error('[Upload Single Error]', err);
      return res.status(400).send(`Lỗi tải ảnh: ${err.message}`);
    }

    if (!req.file) {
      return next();
    }

    try {
      const fileUrl = await optimizeAndUploadImage(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        1200,
        800,
        folder
      );

      req.file.path = fileUrl;
      req.file.url = fileUrl;
      next();
    } catch (uploadError) {
      console.error('[MinIO Single Error]', uploadError);
      return res.status(500).send(`Lỗi lưu trữ MinIO: ${uploadError.message}`);
    }
  });
};

module.exports = {
  uploadAndOptimizeTourMedia,
  uploadAndOptimizeSingleImage,
};
