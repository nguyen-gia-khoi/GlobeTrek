const express = require('express');
const router = express.Router();
const destinationController = require('../../controllers/destinationController');
const {verifyAdmin} = require('../../Middleware/authMiddleware')


router.get('/create',verifyAdmin, destinationController.createDestinationForm); // Hiển thị trang tạo Destination
router.post('/create',verifyAdmin, destinationController.createDestination); // Tạo Destination mới
router.get('/edit/:id',verifyAdmin, destinationController.editDestinationForm); // Hiển thị trang chỉnh sửa Destination
router.post('/edit/:id',verifyAdmin, destinationController.updateDestination); // Cập nhật Destination
router.get('/delete/:id',verifyAdmin, destinationController.confirmDeleteDestination); // Xác nhận xóa Destination
router.post('/delete/:id',verifyAdmin, destinationController.deleteDestination); // Xóa Destination

module.exports = router;