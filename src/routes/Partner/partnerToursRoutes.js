const express = require('express');
const router = express.Router();
const partnerController = require('../../controllers/Partner/tourPartnerController');
const { uploadAndOptimizeTourMedia } = require('../../Middleware/uploadMinio');
const { uploadMultiple } = require('../../Middleware/cloudinary');
const { requireVerifiedPartner } = require('../../Middleware/authMiddleware');

// Select upload middleware (Default: MinIO + Sharp optimization, Fallback: Cloudinary if USE_CLOUDINARY=true)
const uploadMiddleware = process.env.USE_CLOUDINARY === 'true' ? uploadMultiple : uploadAndOptimizeTourMedia;

router.use(requireVerifiedPartner);

router.get('/list', partnerController.getTourList); 

// Tạo tour mới
router.get('/create', partnerController.getCreateTour);
router.post('/create', uploadMiddleware, partnerController.postCreateTour);

// Chỉnh sửa tour
router.get('/edit/:id', partnerController.getUpdateTour);
router.post('/edit/:id', uploadMiddleware, partnerController.postUpdateTour);

// Gửi yêu cầu phê duyệt cho admin
router.post('/request-approval/:id', partnerController.requestApproval);

// Bật/tắt trạng thái tour
router.post('/toggle-status/:id', partnerController.toggleTourStatus);

// Yêu cầu xóa tour
router.post('/requestDeleteTour/:id', partnerController.requestDeleteTour);

module.exports = router;
