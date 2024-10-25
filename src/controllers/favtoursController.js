const FavoriteTour = require("../models/FavTour");

// Lấy danh sách tour yêu thích của người dùng
const getFavoriteTours = async (req, res) => {
  try {
    const { userId } = req.params; // Lấy userId từ tham số
    const favoriteTours = await FavoriteTour.find({ user: userId }).populate("tour");
    res.status(200).json(favoriteTours);
  } catch (error) {
    res.status(500).json({ message: "Error fetching favorite tours", error });
  }
};

// Xóa tour khỏi danh sách yêu thích
const removeFavoriteTour = async (req, res) => {
  const { userId, tourId } = req.params; // Lấy userId và tourId từ params

  try {
    await FavoriteTour.deleteOne({ user: userId, tour: tourId });
    return res.status(200).json({ message: "Tour đã được xóa khỏi danh sách yêu thích" });
  } catch (error) {
    console.error("Lỗi xóa tour yêu thích:", error);
    return res.status(500).json({ message: "Đã xảy ra lỗi khi xóa tour yêu thích" });
  }
};

// Kiểm tra trạng thái yêu thích của tour
const checkIfFavorite = async (req, res) => {
  const { user, tour } = req.body;
  try {
    const favorite = await FavoriteTour.findOne({ user, tour });
    res.status(200).json({ isFavorite: !!favorite });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi kiểm tra trạng thái yêu thích' });
  }
};

// Thêm hoặc xóa tour khỏi danh sách yêu thích
const toggleFavorite = async (req, res) => {
  const { user, tour } = req.body;
  try {
    const existingFavorite = await FavoriteTour.findOne({ user, tour });

    if (existingFavorite) {
      // Nếu đã tồn tại, xóa
      await FavoriteTour.deleteOne({ _id: existingFavorite._id });
      res.status(200).json({ message: 'Tour đã bị hủy yêu thích', isFavorite: false });
    } else {
      // Nếu chưa tồn tại, thêm mới
      const newFavorite = new FavoriteTour({ user, tour });
      await newFavorite.save();
      res.status(201).json({ message: 'Tour đã được thêm vào yêu thích', isFavorite: true });
    }
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi thay đổi trạng thái yêu thích' });
  }
};

// Export các phương thức
module.exports = {
  getFavoriteTours,
  removeFavoriteTour,
  checkIfFavorite,
  toggleFavorite
};
