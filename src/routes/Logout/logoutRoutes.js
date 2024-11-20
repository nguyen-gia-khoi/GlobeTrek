const express = require('express');
const router = express.Router();

router.post('/logout', (req, res) => {
  if (req.cookies.PartneraccessToken) {
      delete req.cookies.PartneraccessToken; // Xóa session của Partner
  } else if (req.cookies.AdminaccessToken) {
      delete req.cookies.AdminaccessToken; // Xóa session của Admin
  }

  // Redirect về trang login
  res.redirect('/api/auth/login');
});

module.exports = router;
