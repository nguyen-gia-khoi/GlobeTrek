
const express = require('express');
const path = require('path');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 8888;
const hostname = process.env.HOST_NAME;
const configViewEngine = require('./src/config/viewEngine');


const connection = require('./src/config/database');
const mongoose = require('mongoose');
//Const router
const toursRouter = require('./src/routes/tourRouter');
const tourTypeRoutes = require('./src/routes/tourTypeRoutes');
const destinationsRoutes = require('./src/routes/destinationRouter');
const scheduleRoutes = require('./src/routes/ScheduleRouter');

// Cấu hình view engine
configViewEngine(app);
// trang home 
app.get('/', (req, res) => {
  res.render('home', { pageTitle: 'Trang Chủ' }); // render file home.ejs từ thư mục views
});




// Middleware để phân tích req.body
app.use(express.json()); // cho JSON
app.use(express.urlencoded({ extended: true })); // cho dữ liệu từ form

// Cấu hình tệp tĩnh
app.use(express.static(path.join(__dirname, 'public')));

// Định nghĩa các route
app.use('/tours', toursRouter);
app.use('/tourtypes', tourTypeRoutes);
app.use('/destinations', destinationsRoutes);
app.use('/schedules', scheduleRoutes);

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
