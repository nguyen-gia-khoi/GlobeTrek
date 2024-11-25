const jwt = require("jsonwebtoken");
const User = require("../models/User");

const middlewareController = {
  verifyToken: async (req, res, next) => {
    const token = req.headers.authorization;
    if (!token) {
      return res.status(401).json({ message: "You're not authenticated" });
    }

    const accessToken = token.split(" ")[1]; // Extract token
    if (!accessToken) {
      return res.status(401).json({ message: "Token is missing" });
    }

    try {
      const decoded = jwt.verify(accessToken, process.env.ACCESS_TOKEN_SECRET);
      const user = await User.findById(decoded.userId).select("-password");
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      req.user = user; // Attach user to request
      next(); // Proceed to the next middleware or route handler
    } catch (error) {
      return res.status(403).json({ message: "Token is not valid", error: error.message });
    }
  },

  verifyAdmin: async (req, res, next) => {
    // Verify token before checking for admin role
    await middlewareController.verifyToken(req, res, () => {
      if (req.user && req.user.role === "admin") {
        return next(); // Proceed if the user is an admin
      }
      return res.status(403).json({ message: "Access denied - Admin only" });
    });
  }
};

module.exports = middlewareController;