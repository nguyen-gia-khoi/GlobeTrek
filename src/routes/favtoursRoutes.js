const express = require('express');
const favoriteController = require('../controllers/favtoursController');
const router = express.Router();

router.post('/toggle', favoriteController.toggleFavorite); // Thêm/xóa yêu thích
router.post('/check', favoriteController.checkIfFavorite); // Kiểm tra trạng thái yêu thích
router.get('/:userId', favoriteController.getFavoriteTours); // Lấy danh sách yêu thích
router.delete('/:userId/:tourId', favoriteController.removeFavoriteTour); // Xóa tour yêu thích



module.exports = router;
