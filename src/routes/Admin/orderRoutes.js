const express = require('express');
const router = express.Router();
const {
  getPaginatedOrder,
  getAllOrders,
  renderOrdersPage,
  updateOrderStatus,
  deleteOrder,
} = require('../../controllers/Admin/orderController');

const {verifyAdmin} = require('../../Middleware/authMiddleware');

// Route hiển thị trang đơn hàng
router.get('/view', renderOrdersPage);

// Lấy tất cả đơn hàng
router.get('/' , getAllOrders);
// Cập nhật trạng thái đơn hàng
router.put('/:orderId/status', verifyAdmin , updateOrderStatus);

// Xóa đơn hàng
router.delete('/:orderId', verifyAdmin , deleteOrder);

module.exports = router;
