const jwt = require("jsonwebtoken");

const User = require("../models/User");

const middlewareController = {
  verifyToken: async (req, res, next) => {
    const token = req.headers.authorization;
    if (token) {
      const accessToken = token.split(" ")[1];
      try {
        const decoded = jwt.verify(
          accessToken,
          process.env.ACCESS_TOKEN_SECRET
        );
        const user = await User.findById(decoded.userId).select("-password");
        console.log(process.env.ACCESS_TOKEN_SECRET);
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }
        req.user = user;
        next();
      } catch (error) {
        return res.status(403).json({ message: "Token is not valid" });
      }
    } else {
      res.status(401).json({ message: "You're not authenticated" });
    }
  },
  verifyAdmin: (req, res, next) => {
    middlewareController.verifyToken(req, res, () => {
      if (req.user && req.user.role === "admin") {
        next();
      } else {
        return res.status(403).json({ message: "Access denied - Admin only" });
      }
    });
  },
  
};
module.exports = middlewareController;
