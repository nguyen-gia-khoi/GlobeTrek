const express = require('express');
const router = express.Router();
const partnerController = require('../../controllers/Partner/tourPartnerController');
const { uploadMultiple } = require('../../Middleware/cloudinary');
const {verifyAdmin} = require('../../Middleware/authMiddleware');

router.get('/list', verifyAdmin , partnerController.getTourList); 

// Tạo tour mới
router.get('/create',verifyAdmin ,  partnerController.getCreateTour);
router.post('/create',verifyAdmin ,  uploadMultiple, partnerController.postCreateTour);

// Chỉnh sửa tour
router.get('/edit/:id',verifyAdmin ,  partnerController.getUpdateTour);
router.post('/edit/:id',verifyAdmin ,  uploadMultiple, partnerController.postUpdateTour);

// Gửi yêu cầu phê duyệt cho admin
router.post('/request-approval/:id',verifyAdmin ,  partnerController.requestApproval);

// Bật/tắt trạng thái tour
router.post('/toggle-status/:id',verifyAdmin ,  partnerController.toggleTourStatus);

// Yêu cầu xóa tour
router.post('/requestDeleteTour/:id',verifyAdmin ,  partnerController.requestDeleteTour);

module.exports = router;
