// const jwt = require("jsonwebtoken");
// const User = require("../models/User");

// const middlewareController = {
//   verifyToken: async (req, res, next) => {
//     const Admintoken = req.cookies.AdminaccessToken|| req.cookies.PartneraccessToken;
//     const token = req.headers.authorization;
//     if (!Admintoken) {
//       return res.redirect("/api/auth/login")
//     }

//     const accessToken = token.split(" ")[1]; // Extract token

//     if (!accessToken) {
//       return res.status(401).json({ message: "Token is missing" });
//     }

//     try {
//       const decoded = jwt.verify(accessToken, process.env.ACCESS_TOKEN_SECRET);
//       const user = await User.findById(decoded.userId).select("-password");
      
//       if (!user) {
//         return res.status(404).json({ message: "User not found" });
//       }
      
//       req.user = user; // Attach user to request
//       next(); // Proceed to the next middleware or route handler
//     } catch (error) {
//       return res.status(403).json({ message: "Token is not valid", error: error.message });
//     }
//   },

//   verifyAdmin: async (req, res, next) => {
//     // Verify token before checking for admin role
//     await middlewareController.verifyToken(req, res, () => {
//       if (req.user && (req.user.role === "admin" || (req.user.role === "partner" && req.user.status === "verified" ))) {
//         return next(); // Proceed if the user is an admin
//       }
//       return res.status(403).json({ message: "Access denied - Admin only" });
//     });
//   }
// };

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
