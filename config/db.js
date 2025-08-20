const mongoose = require("mongoose");
require("dotenv").config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB ga muvaffaqiyatli ulandi!");
  } catch (error) {
    console.error("❌ MongoDB ga ulanishda xatolik:", error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
