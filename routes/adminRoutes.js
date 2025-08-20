const express = require("express");
const router = express.Router();
const Admin = require("../models/admin/admin.model");
const authMiddleware = require("../middleware/authMiddleware");
const { body, validationResult } = require("express-validator");
const jwt = require("jsonwebtoken");

// MongoDB error handler
const handleMongoError = (error) => {
  if (error.name === "MongoServerError" && error.code === 11000) {
    return "Bunday ma'lumotli admin mavjud";
  }
  if (error.name === "CastError") {
    return "Xato ID formati";
  }
  return error.message;
};

// Register validation
const adminValidation = [
  body("phone").trim().notEmpty().withMessage("Telefon majburiy"),
  body("password")
    .isLength({ min: 6 })
    .withMessage("Parol 6 ta belgidan kam bo'lmasligi kerak"),
  body("fullName").trim().notEmpty().withMessage("To'liq ism majburiy"),
  // body("branch").isMongoId().withMessage("Branch ID xato"),
];

// Login validation
const loginValidation = [
  body("phone").trim().notEmpty().withMessage("Telefon majburiy"),
  body("password").notEmpty().withMessage("Parol majburiy"),
];

/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: Администраторы
 */

/**
 * @swagger
 * /api/admin/register:
 *   post:
 *     summary: Создать нового администратора
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               phone:
 *                 type: string
 *               password:
 *                 type: string
 *               fullName:
 *                 type: string
 *               branch:
 *                 type: string
 *               role:
 *                 type: string
 *     responses:
 *       201:
 *         description: Администратор успешно создан
 *       400:
 *         description: Ошибка валидации
 *       403:
 *         description: Нет прав
 */

// Yangi admin yaratish (faqat superadmin uchun)
router.post("/register", authMiddleware, adminValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    if (req?.user?.role !== "superadmin") {
      return res.status(403).json({
        message: "Faqat superadmin admin qo'sha oladi",
      });
    }

    const { phone, password, fullName, branch, role } = req.body;

    const existingAdmin = await Admin.findOne({ phone });
    if (existingAdmin) {
      return res.status(400).json({
        message: "Bunday telefon raqamli admin mavjud",
      });
    }

    // Diqqat: password hash qilinmaydi! Modelning pre-save hook'i hash qiladi
    const admin = new Admin({
      phone,
      password,
      fullName,
      branch,
      role: ["admin", "superadmin", "manager"].includes(role) ? role : "admin",
      isActive: true,
    });

    await admin.save();
    res.status(201).json({ message: "Admin muvaffaqiyatli yaratildi" });
  } catch (error) {
    res.status(500).json({ message: handleMongoError(error) });
  }
});

/**
 * @swagger
 * /api/admin/login:
 *   post:
 *     summary: Вход администратора
 *     tags: [Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               phone:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Успешный вход
 *       400:
 *         description: Неверные данные
 */

// Login
router.post("/login", loginValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { phone, password } = req.body;
    const admin = await Admin.findOne({ phone });
    if (!admin) {
      return res
        .status(404)
        .json({ message: "Admin topilmadi (telefon xato)" });
    }

    // Model method orqali parolni solishtirish
    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: "Telefon yoki parol xato" });
    }

    if (!admin.isActive) {
      return res.status(403).json({ message: "Admin bloklangan" });
    }

    admin.lastLogin = new Date();
    await admin.save();

    const token = jwt.sign(
      { adminId: admin._id, role: admin.role },
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );

    res.json({
      token,
      admin: {
        _id: admin._id,
        fullName: admin.fullName,
        role: admin.role,
        // branch field removed
      },
    });
  } catch (error) {
    res.status(500).json({ message: handleMongoError(error) });
  }
});

// Admin profilini olish
router.get("/profile", authMiddleware, async (req, res) => {
  try {
    const admin = await Admin.findById(req.user.adminId).select("-password");
    if (!admin) {
      return res.status(404).json({ message: "Admin topilmadi" });
    }
    res.json(admin);
  } catch (error) {
    res.status(500).json({ message: handleMongoError(error) });
  }
});

// Admin profilini yangilash (faqat superadmin boshqa adminni o'zgartira oladi)
router.patch(
  "/profile",
  authMiddleware,
  [
    body("_id")
      .exists()
      .isMongoId()
      .withMessage("ID majburiy va to'g'ri bo'lishi kerak"),
    body("fullName")
      .optional()
      .trim()
      .notEmpty()
      .withMessage("To'liq ism bo'sh bo'lmasligi kerak"),
    body("password")
      .optional()
      .isLength({ min: 6 })
      .withMessage("Parol 6 ta belgidan kam bo'lmasligi kerak"),
    // branch field validation removed
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const superAdmin = await Admin.findById(req.user.adminId);
      if (!superAdmin) {
        return res.status(404).json({ message: "Admin topilmadi" });
      }
      if (superAdmin.role !== "superadmin") {
        return res.status(403).json({ message: "Sizda bunday huquq yo'q" });
      }

      const admin = await Admin.findById(req.body._id);
      if (!admin) {
        return res.status(404).json({ message: "Admin topilmadi" });
      }

      const { fullName, password } = req.body;

      if (fullName) {
        admin.fullName = fullName;
      }
      if (typeof password === "string" && password.trim().length >= 6) {
        admin.password = password; // Model pre-save hooki o'zi hash qiladi
      }

      await admin.save();
      res.json({ message: "Profil yangilandi" });
    } catch (error) {
      res.status(500).json({ message: handleMongoError(error) });
    }
  }
);

// Barcha adminlar ro'yxati (faqat superadmin uchun)
router.get("/", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "superadmin") {
      return res.status(403).json({ message: "Ruxsat yo'q" });
    }

    const admins = await Admin.find({ isActive: true })
      .select("-password");
    res.json(admins);
  } catch (error) {
    res.status(500).json({ message: handleMongoError(error) });
  }
});

// Adminni bloklash (faqat superadmin uchun)
router.patch("/:id/deactivate", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "superadmin") {
      return res.status(403).json({ message: "Ruxsat yo'q" });
    }

    const admin = await Admin.findById(req.params.id);
    if (!admin) {
      return res.status(404).json({ message: "Admin topilmadi" });
    }

    admin.isActive = false;
    await admin.save();

    res.json({ message: "Admin bloklandi" });
  } catch (error) {
    res.status(500).json({ message: handleMongoError(error) });
  }
});

module.exports = router;
