
// module.exports = middlewareController;
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const middlewareController = {
  verifyToken: async (req, res, next) => {
    try {
      // Extract token from cookies or Authorization header
      const cookieToken =
        req.cookies.AdminaccessToken || req.cookies.PartneraccessToken;
      const headerToken = req.headers.authorization
        ? req.headers.authorization.split(" ")[1]
        : null;
      const accessToken = cookieToken || headerToken;
      if (!accessToken) {
        return res.redirect("/api/auth/login"); // Redirect if no token found
      }
      // Verify the token
      const decoded = jwt.verify(accessToken, process.env.ACCESS_TOKEN_SECRET);
      // Find user by ID from decoded token payload
      const user = await User.findById(decoded.userId).select("-password");
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Attach user to request for further use
      req.user = user;
      next();
    } catch (error) {
      return res.status(403).json({
        message: "Token is not valid",
        error: error.message,
      });
    }
  },

  verifyAdmin: async (req, res, next) => {
    try {
      // First, verify the token
      await middlewareController.verifyToken(req, res, () => {
        // Check if the user has the admin role or verified partner role
        if (
          req.user &&
          (req.user.role === "admin" ||
            (req.user.role === "partner" && req.user.status === "verified"))
        ) {
          return next(); // Allow access
        }
        return res.status(403).json({
          message: "Access denied - Admin or Verified Partner only",
        });
      });
    } catch (error) {
      return res.status(403).json({
        message: "Access denied",
        error: error.message,
      });
    }
  },

};

module.exports = middlewareController;