const express = require('express');
const favoriteController = require('../controllers/favtoursController');
const router = express.Router();
const {verifyAdmin} = require('../Middleware/authMiddleware');

router.post('/toggle',verifyAdmin ,  favoriteController.toggleFavorite); // Thêm/xóa yêu thích
router.post('/check',verifyAdmin , favoriteController.checkIfFavorite); // Kiểm tra trạng thái yêu thích
router.get('/:userId',verifyAdmin , favoriteController.getFavoriteTours); // Lấy danh sách yêu thích
router.delete('/:userId/:tourId',verifyAdmin , favoriteController.removeFavoriteTour); // Xóa tour yêu thích



module.exports = router;
