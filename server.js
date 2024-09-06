
const express = require('express');
const path = require('path');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 8888;
const hostname = process.env.HOST_NAME;
const configViewEngine = require('./src/config/viewEngine');
const webRoutes = require('./src/routes/web');
const connection = require('./src/config/database');
const mongoose = require('mongoose');

// Cấu hình view engine
configViewEngine(app);

// Middleware để phân tích req.body
app.use(express.json()); // cho JSON
app.use(express.urlencoded({ extended: true })); // cho dữ liệu từ form

// Cấu hình tệp tĩnh
app.use(express.static(path.join(__dirname, 'public')));

// Định nghĩa các route
app.use('/', webRoutes);

(async () => {
  try {
    await connection();
    app.listen(port, hostname, () => {
      console.log(`Ứng dụng mẫu đang nghe trên cổng ${port}`);
    });
  } catch (error) {
    console.log(">>> lỗi kết nối đến db", error);
  }
})();
