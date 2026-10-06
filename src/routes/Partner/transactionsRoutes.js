const express = require("express");
const router = express.Router();
const { requireVerifiedPartner } = require('../../Middleware/authMiddleware');

router.use(requireVerifiedPartner);
router.get('/', (req, res) => {
  res.status(404).json({ message: 'Chưa có giao dịch đối soát' });
});

module.exports = router;
