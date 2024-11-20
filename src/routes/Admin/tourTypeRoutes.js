const express = require('express');
const router = express.Router();
const tourTypeController = require('../../controllers/Admin/tourtypeController');
const {verifyAdmin} = require('../../Middleware/authMiddleware')

router.get('/create',verifyAdmin, tourTypeController.createTourTypeForm); // Hiển thị trang tạo TourType
router.post('/',verifyAdmin, tourTypeController.createTourType); // Tạo TourType mới

router.get('/edit/:id',verifyAdmin, tourTypeController.editTourTypeForm); // Hiển thị trang chỉnh sửa TourType
router.post('/:id',verifyAdmin, tourTypeController.updateTourType); // Cập nhật TourType
router.get('/delete/:id', verifyAdmin,tourTypeController.confirmDeleteTourType); // Xác nhận xóa TourType
router.post('/delete/:id', verifyAdmin,tourTypeController.deleteTourType);


module.exports = router;
