const express = require('express');
const router = express.Router();
const destinationController = require('../../controllers/Admin/destinationController');
const { requireAdmin } = require('../../Middleware/authMiddleware');

const { uploadAndOptimizeSingleImage } = require('../../Middleware/uploadMinio');
const uploadDestinationImage = uploadAndOptimizeSingleImage('destinations');

router.use(requireAdmin);

router.get('/' ,destinationController.getAllDestinations); // Hiển thị tất cả Destination
router.get('/create' ,destinationController.createDestinationForm); // Hiển thị trang tạo Destination
router.post('/create' , uploadDestinationImage, destinationController.createDestination); // Tạo Destination mới
router.get('/edit/:id' ,destinationController.editDestinationForm); // Hiển thị trang chỉnh sửa Destination
router.post('/edit/:id' , uploadDestinationImage, destinationController.updateDestination); // Cập nhật Destination
router.post('/:id' , uploadDestinationImage, destinationController.updateDestination);
router.get('/delete/:id' ,destinationController.confirmDeleteDestination); // Xác nhận xóa Destination
router.post('/delete/:id' ,destinationController.deleteDestination); // Xóa Destination

module.exports = router;