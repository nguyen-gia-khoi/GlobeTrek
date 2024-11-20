const express = require('express');
const router = express.Router();
const adminController = require('../../controllers/Admin/tourController');
const {uploadMultiple} = require('../../Middleware/cloudinary');
const {verifyAdmin} = require('../../Middleware/authMiddleware');
// Danh sách tour (Admin)
router.get('/list',verifyAdmin, adminController.getTours);
router.get('/api/list',verifyAdmin, adminController.getToursAPI);

// Danh sách yêu cầu xóa tour từ partner
router.get('/delete-requests',verifyAdmin, adminController.getDeleteRequests);
router.post('/confirm-delete/:id',verifyAdmin, adminController.confirmDeleteTour);
// Danh sách yêu cầu thêm tour từ partner
router.get('/add-requests',verifyAdmin, adminController.getAddRequests);
router.post('/confirm-add/:id',verifyAdmin, adminController.confirmAddTour);

// Bật/tắt trạng thái tour (Admin)
router.post('/toggle-status/:id',verifyAdmin, adminController.toggleTourStatus);

module.exports = router;
