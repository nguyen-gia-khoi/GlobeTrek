const express = require('express');
const router = express.Router();
const adminController = require('../../controllers/Admin/tourController');
const {uploadMultiple} = require('../../Middleware/cloudinary');
// Danh sách tour (Admin)
router.get('/list', adminController.getTours);
router.get('/api/list', adminController.getToursAPI);

// Danh sách yêu cầu xóa tour từ partner
router.get('/delete-requests', adminController.getDeleteRequests);
router.post('/confirm-delete/:id', adminController.confirmDeleteTour);
// Danh sách yêu cầu thêm tour từ partner
router.get('/add-requests', adminController.getAddRequests);
router.post('/confirm-add/:id', adminController.confirmAddTour);

// Bật/tắt trạng thái tour (Admin)
router.post('/toggle-status/:id', adminController.toggleTourStatus);

module.exports = router;
