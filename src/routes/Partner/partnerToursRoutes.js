const express = require('express');
const router = express.Router();
const partnerController = require('../../controllers/Partner/tourPartnerController');
const { uploadMultiple } = require('../../Middleware/cloudinary');
const {verifyAdmin} = require('../../Middleware/authMiddleware');

router.get('/list' , partnerController.getTourList); 

// Tạo tour mới
router.get('/create' ,  partnerController.getCreateTour);
router.post('/create' ,  uploadMultiple, partnerController.postCreateTour);

// Chỉnh sửa tour
router.get('/edit/:id' ,  partnerController.getUpdateTour);
router.post('/edit/:id' ,  uploadMultiple, partnerController.postUpdateTour);

// Gửi yêu cầu phê duyệt cho admin
router.post('/request-approval/:id' ,  partnerController.requestApproval);

// Bật/tắt trạng thái tour
router.post('/toggle-status/:id' ,  partnerController.toggleTourStatus);

// Yêu cầu xóa tour
router.post('/requestDeleteTour/:id' ,  partnerController.requestDeleteTour);

module.exports = router;
