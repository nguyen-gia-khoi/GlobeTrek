const express = require('express');
const router = express.Router();
const destinationController = require('../../controllers/Admin/destinationController');
const {verifyAdmin} = require('../../Middleware/authMiddleware');


router.get('/create' ,destinationController.createDestinationForm); // Hiển thị trang tạo Destination
router.post('/create' ,destinationController.createDestination); // Tạo Destination mới
router.get('/edit/:id' ,destinationController.editDestinationForm); // Hiển thị trang chỉnh sửa Destination
router.post('/edit/:id' ,destinationController.updateDestination); // Cập nhật Destination
router.get('/delete/:id' ,destinationController.confirmDeleteDestination); // Xác nhận xóa Destination
router.post('/delete/:id' ,destinationController.deleteDestination); // Xóa Destination

module.exports = router;