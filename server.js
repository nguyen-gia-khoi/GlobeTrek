const express = require('express');
const path = require('path');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 8888;
const hostname = process.env.HOST_NAME;
const configViewEngine = require('./src/config/viewEngine');

const connection = require('./src/config/database');
const mongoose = require('mongoose');
mongoose.set('strictQuery', false);



// Customer routes
const toursRouter = require('./src/routes/tourRoutes');
const tourTypeRoutes = require('./src/routes/tourTypeRoutes');
const destinationsRoutes = require('./src/routes/destinationRoutes');
const scheduleRoutes = require('./src/routes/ScheduleRoutes');
const authRoutes = require("./src/routes/authRoutes");
const orderRoutes = require("./src/routes/orderRoutes");
const favoriteTourRoutes = require("./src/routes/favtoursRoutes");
// Admin routes
const toursRoutesAdmin = require('./src/routes/Admin/tourRoutes');
const tourTypeRoutesAdmin = require('./src/routes/Admin/tourTypeRoutes');
const destinationsRoutesAdmin = require('./src/routes/Admin/destinationRoutes');
const scheduleRoutesAdmin = require('./src/routes/Admin/scheduleRoutes');
const orderRoutesAdmin = require('./src/routes/Admin/orderRoutes');


const cookieParser = require("cookie-parser");
const cors = require("cors");



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
  origin: ["https://globetrek-six.vercel.app" ,"http://localhost:5173" , "*"],
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true, // Allow sending cookies
};
app.use(cors(corsOptions));

// Auth routes
app.use("/api/auth", authRoutes);

// User routes
app.use('/tours', toursRouter);
app.use('/tourtypes', tourTypeRoutes);
app.use('/destinations', destinationsRoutes);
app.use('/schedules', scheduleRoutes);
app.use('/orders', orderRoutes);
app.use("/favorite-tours", favoriteTourRoutes);


// Admin routes
app.use('/admin/tours', toursRoutesAdmin);
app.use('/admin/tourtypes', tourTypeRoutesAdmin);
app.use('/admin/destinations', destinationsRoutesAdmin);
app.use('/admin/schedules', scheduleRoutesAdmin);
app.use('/admin/orders', orderRoutesAdmin );

// Database connection and server start
(async () => {
  try {
    await connection();
    app.listen(port, () => {
      console.log(`Ứng dụng mẫu đang nghe trên cổng http://localhost:${port}`);
    });
  } catch (error) {
    console.log(">>> lỗi kết nối đến db", error);
  }
})();