# GlobeTrek

Nền tảng quản lý và điều hành tour du lịch. Đối tác đăng tour và theo dõi lịch khởi hành, ban quản trị duyệt nội dung và xem doanh thu, khách đặt tour qua ứng dụng riêng.

Cổng trong repo này dành cho **Admin** và **Đối tác**. Ảnh bên dưới chụp từ dữ liệu thử trên máy local.

## Cổng vào

Admin và đối tác dùng chung trang đăng nhập. Sau khi đăng nhập, hệ thống mở đúng khu vực của từng vai trò.

![Đăng nhập](docs/screenshots/login.png)

Đối tác chưa có tài khoản đăng ký hồ sơ tại đây. Tài khoản chỉ vào được khu vực đối tác sau khi Admin duyệt.

![Đăng ký đối tác](docs/screenshots/register.png)

## Admin

### Duyệt đối tác

Trang chủ Admin. Hồ sơ đối tác mới hiện trong hàng chờ để phê duyệt hoặc từ chối. Các thẻ dẫn nhanh sang đối tác đã duyệt, danh sách tour và báo cáo doanh thu.

![Duyệt đối tác](docs/screenshots/admin-approve-partners.png)

### Đơn hàng

Đơn đặt tour của toàn hệ thống, gom theo tour và ngày khởi hành: số khách, số vé và chi tiết từng đơn.

![Đơn hàng Admin](docs/screenshots/admin-orders.png)

### Danh sách tour

Mọi tour trên nền tảng, lọc theo đối tác, trạng thái, quốc gia, vùng miền, điểm đến, ngày có lịch và số ngày. Từ đây Admin xem chi tiết hoặc sang hàng chờ duyệt.

![Danh sách tour Admin](docs/screenshots/admin-tours.png)

### Duyệt thêm tour

Tour đối tác vừa tạo, chờ Admin kiểm tra giá, lịch trình và điểm đến trước khi mở bán.

![Duyệt thêm tour](docs/screenshots/admin-tour-add-requests.png)

### Duyệt xóa tour

Yêu cầu gỡ tour do đối tác gửi. Admin xác nhận rồi tour mới bị xóa.

![Duyệt xóa tour](docs/screenshots/admin-tour-delete-requests.png)

### Loại tour

Danh sách phân loại tour. Thêm và sửa mở ngay trên trang. Nút xóa dẫn sang trang xác nhận riêng.

![Loại tour](docs/screenshots/admin-tour-types.png)

![Xác nhận xóa loại tour](docs/screenshots/admin-tour-type-delete.png)

### Điểm đến

Điểm đến gắn với quốc gia và vùng miền, kèm số tour đang dùng. Có lọc, tìm kiếm, thêm mới, sửa và xóa.

![Điểm đến](docs/screenshots/admin-destinations.png)

![Sửa điểm đến](docs/screenshots/admin-destination-edit.png)

![Xác nhận xóa điểm đến](docs/screenshots/admin-destination-delete.png)

### Quốc gia và vùng miền

Hai danh mục nền cho điểm đến và tour. Mỗi trang có thêm, sửa và tắt kích hoạt.

![Quốc gia](docs/screenshots/admin-countries.png)

![Vùng miền](docs/screenshots/admin-regions.png)

### Doanh thu

Doanh thu đơn đã thanh toán được chia **30%** cho nền tảng và **70%** cho đối tác.

Theo ngày: bảy ngày gần nhất.

![Doanh thu theo ngày](docs/screenshots/admin-revenue-daily.png)

Theo tháng: sáu tháng gần nhất.

![Doanh thu theo tháng](docs/screenshots/admin-revenue-monthly.png)

Theo năm: hai năm gần nhất.

![Doanh thu theo năm](docs/screenshots/admin-revenue-yearly.png)

Theo tuần: doanh thu từng tour của mỗi đối tác trong tuần đang chọn.

![Doanh thu đối tác theo tuần](docs/screenshots/admin-revenue-weekly.png)

Quyết toán tháng: phần Admin, phần đối tác và trạng thái chi trả. Chi trả thật đang tạm khóa, trang chỉ dùng để đối soát.

![Quyết toán tháng](docs/screenshots/admin-revenue-payout.png)

Tổng tích lũy của từng đối tác đến ngày xem báo cáo.

![Tổng doanh thu đối tác](docs/screenshots/admin-revenue-total.png)

### Khách hàng và đối tác đã duyệt

Khách hàng: email, trạng thái tài khoản, số lần hủy tour, xem chi tiết và khóa tài khoản.

![Khách hàng](docs/screenshots/admin-users.png)

Đối tác đã duyệt: hồ sơ doanh nghiệp và nút hủy quyền nếu cần thu hồi.

![Đối tác đã duyệt](docs/screenshots/admin-partners.png)

## Đối tác

Hai mục trên menu chưa có trang riêng: **Đối soát & Rút tiền** và **Đánh giá từ khách**. Cả hai sắp ra mắt.

### Doanh thu

Tổng doanh thu đến ngày hiện tại, số tour đang giao dịch, bảng doanh thu từng tour và biểu đồ tỷ trọng.

![Doanh thu đối tác](docs/screenshots/partner-revenue.png)

### Đơn hàng

Đơn khách đặt, gom theo tour và ngày khởi hành. Lọc theo tên tour, ngày khởi hành và xem chi tiết khách của từng đợt.

![Đơn hàng đối tác](docs/screenshots/partner-orders.png)

### Danh sách tour

Tour của chính đối tác đang đăng nhập: giá, thời lượng, trạng thái bán, sửa, tạm dừng hoặc gửi yêu cầu xóa.

![Danh sách tour đối tác](docs/screenshots/partner-tours.png)

### Tạo tour và sửa tour

Biểu mẫu ba bước: thông tin và bảng giá, lịch trình từng ngày, rồi hình ảnh và lịch khởi hành. Giá trẻ em và lễ được tính từ giá người lớn theo tỷ lệ.

![Tạo tour](docs/screenshots/partner-tour-create.png)

![Sửa tour](docs/screenshots/partner-tour-edit.png)

### Lịch khởi hành và chỗ

Từng ngày mở bán: sức chứa, chỗ đang giữ, chỗ đã bán, chỗ còn trống và trạng thái. Có thể thêm lịch theo ngày hoặc theo khoảng.

![Lịch khởi hành](docs/screenshots/partner-departures.png)

### Báo cáo hiệu suất tour

Theo ngày khởi hành trong kỳ đang chọn. Các chỉ số gồm doanh thu, đơn đã thanh toán, số khách, công suất chỗ và tỷ lệ hủy, kèm kỳ liền trước để so sánh. Có biểu đồ theo ngày, xếp hạng tour và bảng chi tiết. Xuất được file Excel.

![Hiệu suất tour](docs/screenshots/partner-performance.png)

### Lịch sử mua hàng

Từng đơn của khách trên tour của đối tác: người đặt, ngày khởi hành, ngày đặt, số khách, số tiền và trạng thái thanh toán.

![Lịch sử mua hàng](docs/screenshots/partner-purchase-history.png)

### Mã giảm giá và ưu đãi tự động

Mã giảm giá là mã khách nhập lúc đặt. Mỗi đơn nhận một ưu đãi. Trang quản lý mức giảm, phạm vi tour, thời gian và số lượt đã dùng.

![Mã giảm giá](docs/screenshots/partner-promotions.png)

Ưu đãi tự động áp vào tour mà khách không cần nhập mã.

![Ưu đãi tự động](docs/screenshots/partner-offers.png)

## Công nghệ

- Node.js, Express, EJS
- MongoDB và Redis
- JWT lưu trong cookie httpOnly cho cổng quản trị
- MinIO cho ảnh tour
- Chart.js cho biểu đồ doanh thu

## Chạy trên máy

Cần Node.js, MongoDB và Redis.

```bash
npm install
copy .env.example .env
npm start
```

Mở [http://localhost:8081](http://localhost:8081). Cổng mặc định trong `.env.example` là `8081`.

Điền chuỗi kết nối MongoDB, Redis và các khóa trong `.env`. Không commit file `.env`.

`docker-compose.yml` dựng kèm MongoDB, Redis và MinIO khi muốn chạy bằng Docker.

## Bố cục mã

```
server.js                 # Điểm vào, cổng quản trị và API
src/controllers           # Xử lý theo Admin, Partner và khách
src/routes                # Đường dẫn /admin, /partner và API công khai
src/models                # Tour, lịch khởi hành, đơn hàng, người dùng
src/views                 # Giao diện EJS của Admin và Đối tác
src/public                # CSS, ảnh và script phía trình duyệt
```
