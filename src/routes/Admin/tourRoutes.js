const express = require('express');
const router = express.Router();
const partnerController = require('../../controllers/Partner/tourPartnerController');
const adminController = require('../../controllers/Admin/tourController');
const {uploadMultiple} = require('../../Middleware/cloudinary');
// --------------------------------- Routes cho Partner ---------------------------------

// Danh sách tour của Partner
router.get('/partner/list', partnerController.getTourList); 

// Tạo tour mới
router.get('/partner/create', partnerController.getCreateTour);
router.post('/partner/create',uploadMultiple, partnerController.postCreateTour);

// Chỉnh sửa tour
router.get('/partner/edit/:id', partnerController.getUpdateTour);
router.post('/partner/edit/:id', uploadMultiple,partnerController.postUpdateTour);

// Gửi yêu cầu phê duyệt cho admin
router.post('/partner/request-approval/:id', partnerController.requestApproval);

// Bật/tắt trạng thái tour
router.post('/partner/toggle-status/:id', partnerController.toggleTourStatus);
router.post('/partner/requestDeleteTour/:id', partnerController.requestDeleteTour);

// --------------------------------- Routes cho Admin ---------------------------------

// Danh sách tour (Admin)
router.get('/list', adminController.getTours);

// Danh sách yêu cầu xóa tour từ partner
router.get('/delete-requests', adminController.getDeleteRequests);
router.post('/confirm-delete/:id', adminController.confirmDeleteTour);

// Danh sách yêu cầu thêm tour từ partner
router.get('/add-requests', adminController.getAddRequests);
router.post('/confirm-add/:id', adminController.confirmAddTour);

// Bật/tắt trạng thái tour (Admin)
router.post('/toggle-status/:id', adminController.toggleTourStatus);

module.exports = router;
