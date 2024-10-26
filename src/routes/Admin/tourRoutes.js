const express = require('express');
const router = express.Router();
const tourController = require('../../controllers/Admin/tourController');
const {uploadMultiple} = require('../../Middleware/cloudinary');
const {verifyAdmin} = require('../../Middleware/authMiddleware')


router.get('/create', tourController.getCreateTour); // Hiển thị form tạo tour

router.post('/create', uploadMultiple, tourController.postCreateTour); // Tạo tour mới
router.get('/edit/:id', tourController.getUpdateTour); // Hiển thị form chỉnh sửa tour
router.post('/edit/:id',uploadMultiple, tourController.postUpdateTour); // Cập nhật tour
router.get('/delete/:id', tourController.getDeleteTour); // Hiển thị trang xác nhận xóa tour
router.post('/delete/:id', tourController.postDeleteTour); // Xóa tour

router.post('/toggle-status', tourController.toggleTourStatus); // Toggle trạng thái lịch

module.exports = router;