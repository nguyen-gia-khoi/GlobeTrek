const jwt = require("jsonwebtoken");
const Transaction = require("../../models/Transaction"); 

// Lấy danh sách giao dịch/doanh thu của Partner
const getPartnerTransactions = async (req, res) => {
  try {
    const token = req.cookies.PartneraccessToken;
    if (!token) {
      return res.status(401).json({ message: "Token not found, please login" });
    }

    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    const partnerId = decoded.userId;

    if (!partnerId) {
      return res.status(400).json({ message: "Partner ID not found in token" });
    }
    const transactions = await Transaction.find({ partner: partnerId }).sort({
      date: -1, 
    });

    res.render("Revenue/Partner/PartnerTransactions", {
      transactions,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Error retrieving transactions",
    });
  }
};

module.exports = {
  getPartnerTransactions,
};
