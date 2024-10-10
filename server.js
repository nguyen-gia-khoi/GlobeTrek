const express = require('express');
const path = require('path');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 8888;
const hostname = process.env.HOST_NAME;
const configViewEngine = require('./src/config/viewEngine');

const connection = require('./src/config/database');
const mongoose = require('mongoose');

// Import routers
const toursRouter = require('./src/routes/tourRoutes');
const tourTypeRoutes = require('./src/routes/tourTypeRoutes');
const destinationsRoutes = require('./src/routes/destinationRoutes');

const authRoutes = require("./src/routes/authRoutes");
const cookieParser = require("cookie-parser");
const cors = require("cors");

const scheduleRoutes = require('./src/routes/scheduleRoutes');

// Cấu hình view engine
configViewEngine(app);

// Home route
app.get('/', (req, res) => {
  res.render('home', { pageTitle: 'Trang Chủ' }); // Render home.ejs from views folder
});

// Middleware for parsing request bodies
app.use(express.json()); // For JSON
app.use(express.urlencoded({ extended: true })); // For form data

// Static file configuration
app.use(express.static(path.join(__dirname, 'public')));

// Cookie parser middleware
app.use(cookieParser());

// CORS configuration
const corsOptions = {
  origin: "http://localhost:3000", // Removed trailing slash
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true, // Allow sending cookies
};
app.use(cors(corsOptions));

// Auth routes
app.use("/api/auth", authRoutes);

// Define routes
app.use('/tours', toursRouter);
app.use('/tourtypes', tourTypeRoutes);
app.use('/destinations', destinationsRoutes);
app.use('/schedules', scheduleRoutes);

// Database connection and server start
(async () => {
  try {
    await connection();
    app.listen(port, hostname, () => {
      console.log(`Ứng dụng mẫu đang nghe trên cổng http://localhost:${port}`);
    });
  } catch (error) {
    console.log(">>> lỗi kết nối đến db", error);
  }
})();
