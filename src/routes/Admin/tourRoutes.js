const express = require('express');
const router = express.Router();
const tourController = require('../../controllers/tourController');
const {uploadMultiple} = require('../../Middleware/cloudinary');
const {verifyAdmin} = require('../../Middleware/authMiddleware')


router.get('/create',verifyAdmin, tourController.getCreateTour); // Hiển thị form tạo tour
router.post('/create', verifyAdmin,uploadMultiple, tourController.postCreateTour); // Tạo tour mới
router.get('/edit/:id',verifyAdmin, tourController.getUpdateTour); // Hiển thị form chỉnh sửa tour
router.post('/edit/:id',verifyAdmin,uploadMultiple, tourController.postUpdateTour); // Cập nhật tour
router.get('/delete/:id', verifyAdmin,tourController.getDeleteTour); // Hiển thị trang xác nhận xóa tour
router.post('/delete/:id', verifyAdmin,tourController.postDeleteTour); // Xóa tour
router.post('/toggle-schedule',verifyAdmin, tourController.toggleScheduleStatus); // Toggle trạng thái lịch

module.exports = router;