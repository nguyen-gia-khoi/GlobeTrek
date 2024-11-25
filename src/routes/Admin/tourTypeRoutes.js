const express = require('express');
const router = express.Router();
const tourTypeController = require('../../controllers/Admin/tourtypeController');
const {verifyAdmin} = require('../../Middleware/authMiddleware')

router.get('/create', tourTypeController.createTourTypeForm); // Hiển thị trang tạo TourType
router.post('/', tourTypeController.createTourType); // Tạo TourType mới

router.get('/edit/:id' ,tourTypeController.editTourTypeForm); // Hiển thị trang chỉnh sửa TourType
router.post('/:id' , tourTypeController.updateTourType); // Cập nhật TourType
router.get('/delete/:id' ,tourTypeController.confirmDeleteTourType); // Xác nhận xóa TourType
router.post('/delete/:id' ,tourTypeController.deleteTourType);


module.exports = router;
