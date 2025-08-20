const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const { body, validationResult } = require("express-validator");
const SMS = require("../models/sms/sms.model");
const smsNotificationService = require("../services/smsNotificationService");
const {
  sendSMS,
  sendSMSWithCallback,
  sendMultipleSMS,
  getSMSStatus,
  getBalance,
  testConnection,
  getUserInfo,
  createTemplate,
  getTemplates,
  getTemplateById,
  getSMSTotals,
  getTotalsByRange,
  getTotalsByDispatch,
  sendVerificationSMS,
  generateVerificationCode,
  checkSMSMessage,
} = require("../config/eskizuz");

// Validation rules
const smsValidation = [
  body("phone")
    .trim()
    .notEmpty()
    .withMessage("Telefon raqami majburiy")
    .matches(/^998\d{9}$/)
    .withMessage("Telefon raqami 998XXXXXXXXX formatida bo'lishi kerak"),
  body("message")
    .trim()
    .notEmpty()
    .withMessage("Xabar matni majburiy")
    .isLength({ max: 918 })
    .withMessage("Xabar 918 belgidan oshmasligi kerak"),
];

const multipleSmsValidation = [
  body("recipients")
    .isArray({ min: 1 })
    .withMessage("Qabul qiluvchilar ro'yxati majburiy"),
  body("recipients.*.phone")
    .trim()
    .notEmpty()
    .withMessage("Telefon raqami majburiy")
    .matches(/^998\d{9}$/)
    .withMessage("Telefon raqami 998XXXXXXXXX formatida bo'lishi kerak"),
  body("recipients.*.message")
    .trim()
    .notEmpty()
    .withMessage("Xabar matni majburiy")
    .isLength({ max: 918 })
    .withMessage("Xabar 918 belgidan oshmasligi kerak"),
];

const verificationValidation = [
  body("phone")
    .trim()
    .notEmpty()
    .withMessage("Telefon raqami majburiy")
    .matches(/^998\d{9}$/)
    .withMessage("Telefon raqami 998XXXXXXXXX formatida bo'lishi kerak"),
  body("appName")
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage("Ilova nomi 20 belgidan oshmasligi kerak"),
];

const templateValidation = [
  body("template")
    .trim()
    .notEmpty()
    .withMessage("Shablon matni majburiy")
    .isLength({ max: 918 })
    .withMessage("Shablon 918 belgidan oshmasligi kerak"),
];

const callbackSmsValidation = [
  body("phone")
    .trim()
    .notEmpty()
    .withMessage("Telefon raqami majburiy")
    .matches(/^998\d{9}$/)
    .withMessage("Telefon raqami 998XXXXXXXXX formatida bo'lishi kerak"),
  body("message")
    .trim()
    .notEmpty()
    .withMessage("Xabar matni majburiy")
    .isLength({ max: 918 })
    .withMessage("Xabar 918 belgidan oshmasligi kerak"),
  body("callbackUrl")
    .optional()
    .isURL()
    .withMessage("Callback URL noto'g'ri formatda"),
];

const totalsValidation = [
  body("year")
    .isInt({ min: 2020, max: new Date().getFullYear() + 1 })
    .withMessage("Yil 2020 dan bugungi kunga qadar bo'lishi kerak"),
  body("month")
    .optional()
    .isInt({ min: 1, max: 12 })
    .withMessage("Oy 1 dan 12 gacha bo'lishi kerak"),
  body("isGlobal")
    .optional()
    .isBoolean()
    .withMessage("isGlobal boolean qiymat bo'lishi kerak"),
];

const rangeValidation = [
  body("startDate")
    .matches(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/)
    .withMessage("Boshlanish sanasi YYYY-MM-DD HH:MM formatida bo'lishi kerak"),
  body("endDate")
    .matches(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/)
    .withMessage("Tugash sanasi YYYY-MM-DD HH:MM formatida bo'lishi kerak"),
  body("status")
    .optional()
    .isIn(["", "delivered", "rejected"])
    .withMessage("Status bo'sh, 'delivered' yoki 'rejected' bo'lishi kerak"),
  body("isAd")
    .optional()
    .isIn(["", "0", "1"])
    .withMessage("isAd bo'sh, '0' yoki '1' bo'lishi kerak"),
];

const dispatchValidation = [
  body("dispatchId").trim().notEmpty().withMessage("Dispatch ID majburiy"),
  body("status")
    .optional()
    .isIn(["", "delivered", "rejected"])
    .withMessage("Status bo'sh, 'delivered' yoki 'rejected' bo'lishi kerak"),
  body("isAd")
    .optional()
    .isIn(["", "0", "1"])
    .withMessage("isAd bo'sh, '0' yoki '1' bo'lishi kerak"),
];

const checkSmsValidation = [
  body("message")
    .trim()
    .notEmpty()
    .withMessage("Xabar matni majburiy")
    .isLength({ max: 918 })
    .withMessage("Xabar 918 belgidan oshmasligi kerak"),
];

const templateIdValidation = [
  body("templateId").trim().notEmpty().withMessage("Shablon ID majburiy"),
];

/**
 * @swagger
 * tags:
 *   name: SMS
 *   description: SMS хizматлari
 */

/**
 * @swagger
 * /api/sms/send:
 *   post:
 *     summary: Bitta SMS jo'natish
 *     tags: [SMS]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *               - message
 *             properties:
 *               phone:
 *                 type: string
 *                 description: Telefon raqami (998XXXXXXXXX formatida)
 *                 example: "998901234567"
 *               message:
 *                 type: string
 *                 description: SMS matni
 *                 example: "Sizning buyurtmangiz tayyor!"
 *               from:
 *                 type: string
 *                 description: Jo'natuvchi nomi (ixtiyoriy)
 *                 example: "4546"
 *     responses:
 *       200:
 *         description: SMS muvaffaqiyatli jo'natildi
 *       400:
 *         description: Xato ma'lumotlar
 *       401:
 *         description: Avtorizatsiya xatosi
 *       500:
 *         description: Server xatosi
 */
router.post("/send", authMiddleware, smsValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: "Validation error",
        errors: errors.array(),
      });
    }

    const { phone, message, from } = req.body;

    // SMS jo'natish
    const result = await sendSMS(phone, message, from);

    if (result.response?.data.message) {
      return res.status(400).json({
        message: result.response.data.message,
        error: result.response.data.error,
      });
    }

    // Ma'lumotlarni bazaga saqlash
    const smsRecord = new SMS({
      phone: result.phone || phone,
      message: result.message || message,
      messageId: result.message_id,
      status: result.status,
      cost: result.cost || 0,
      parts: result.parts || 1,
      sentBy: req.admin ? req.admin.id : null, // req.admin mavjudligini tekshirish
      sentAt: new Date(),
    });

    await smsRecord.save();

    res.status(200).json({
      message: "SMS muvaffaqiyatli jo'natildi",
      data: {
        message_id: result.message_id,
        status: result.status,
        phone: result.phone || phone,
        message: result.message || message,
        cost: result.cost,
        parts: result.parts,
      },
    });
  } catch (error) {
    console.error("SMS jo'natish xatosi:", error);
    res.status(500).json({
      message: "SMS jo'natishda xatolik yuz berdi",
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /api/sms/send-multiple:
 *   post:
 *     summary: Ko'plab SMS jo'natish
 *     tags: [SMS]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - recipients
 *             properties:
 *               recipients:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - phone
 *                     - message
 *                   properties:
 *                     phone:
 *                       type: string
 *                       example: "998901234567"
 *                     message:
 *                       type: string
 *                       example: "Sizning buyurtmangiz tayyor!"
 *                     from:
 *                       type: string
 *                       example: "4546"
 *     responses:
 *       200:
 *         description: SMS'lar jo'natildi
 *       400:
 *         description: Xato ma'lumotlar
 *       401:
 *         description: Avtorizatsiya xatosi
 *       500:
 *         description: Server xatosi
 */
router.post(
  "/send-multiple",
  authMiddleware,
  multipleSmsValidation,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          message: "Validation error",
          errors: errors.array(),
        });
      }

      const { recipients } = req.body;

      // Ko'plab SMS jo'natish
      const results = await sendMultipleSMS(recipients);

      // Muvaffaqiyatli jo'natilgan SMS'larni bazaga saqlash
      const smsRecords = [];
      for (const result of results) {
        if (result.success) {
          const smsRecord = new SMS({
            phone: result.result.phone,
            message: result.result.message,
            messageId: result.result.message_id,
            status: result.result.status,
            cost: result.result.cost,
            parts: result.result.parts,
            sentBy: req.admin ? req.admin.id : null,
            sentAt: new Date(),
          });
          smsRecords.push(smsRecord);
        }
      }

      if (smsRecords.length > 0) {
        await SMS.insertMany(smsRecords);
      }

      const successCount = results.filter((r) => r.success).length;
      const errorCount = results.filter((r) => !r.success).length;

      res.status(200).json({
        message: `${successCount} ta SMS muvaffaqiyatli jo'natildi, ${errorCount} ta xatolik`,
        data: {
          total: results.length,
          success: successCount,
          errors: errorCount,
          results: results,
        },
      });
    } catch (error) {
      console.error("Ko'plab SMS jo'natish xatosi:", error);
      res.status(500).json({
        message: "SMS'larni jo'natishda xatolik yuz berdi",
        error: error.message,
      });
    }
  }
);

/**
 * @swagger
 * /api/sms/send-verification:
 *   post:
 *     summary: Tasdiqlash kodini SMS orqali jo'natish
 *     tags: [SMS]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *             properties:
 *               phone:
 *                 type: string
 *                 description: Telefon raqami (998XXXXXXXXX formatida)
 *                 example: "998901234567"
 *               code:
 *                 type: string
 *                 description: Tasdiqlash kodi (ixtiyoriy, avtomatik yaratiladi)
 *                 example: "123456"
 *               appName:
 *                 type: string
 *                 description: Ilova nomi (ixtiyoriy)
 *                 example: "Sklad"
 *     responses:
 *       200:
 *         description: Tasdiqlash kodi muvaffaqiyatli jo'natildi
 *       400:
 *         description: Xato ma'lumotlar
 *       500:
 *         description: Server xatosi
 */
router.post("/send-verification", verificationValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: "Validation error",
        errors: errors.array(),
      });
    }

    const { phone, code, appName } = req.body;

    // Tasdiqlash SMS'ini jo'natish
    const result = await sendVerificationSMS(phone, code, appName);

    // Ma'lumotlarni bazaga saqlash (kodni saqlamaslik xavfsizlik uchun)
    const smsRecord = new SMS({
      phone: result.phone,
      message: result.message,
      messageId: result.message_id,
      status: result.status,
      cost: result.cost,
      parts: result.parts,
      type: "verification",
      sentAt: new Date(),
    });

    await smsRecord.save();

    res.status(200).json({
      message: "Tasdiqlash kodi muvaffaqiyatli jo'natildi",
      data: {
        message_id: result.message_id,
        status: result.status,
        phone: result.phone,
        verification_code: result.verification_code, // Bu production'da olib tashlanishi kerak
      },
    });
  } catch (error) {
    console.error("Tasdiqlash SMS'i jo'natish xatosi:", error);
    res.status(500).json({
      message: "Tasdiqlash SMS'ini jo'natishda xatolik yuz berdi",
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /api/sms/status/{messageId}:
 *   get:
 *     summary: SMS holatini tekshirish
 *     tags: [SMS]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *         description: SMS ID raqami
 *     responses:
 *       200:
 *         description: SMS holati
 *       401:
 *         description: Avtorizatsiya xatosi
 *       404:
 *         description: SMS topilmadi
 *       500:
 *         description: Server xatosi
 */
router.get("/status/:messageId", authMiddleware, async (req, res) => {
  try {
    const { messageId } = req.params;

    // SMS holatini Eskiz API dan olish
    const status = await getSMSStatus(messageId);

    // Bazadagi ma'lumotni yangilash
    await SMS.findOneAndUpdate(
      { messageId: messageId },
      {
        status: status.status,
        statusNote: status.status_note,
        updatedAt: new Date(),
      }
    );

    res.status(200).json({
      message: "SMS holati",
      data: status,
    });
  } catch (error) {
    console.error("SMS holatini tekshirish xatosi:", error);
    res.status(500).json({
      message: "SMS holatini tekshirishda xatolik yuz berdi",
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /api/sms/balance:
 *   get:
 *     summary: Hisob balansini tekshirish
 *     tags: [SMS]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Hisob balansi ma'lumotlari
 *       401:
 *         description: Avtorizatsiya xatosi
 *       500:
 *         description: Server xatosi
 */
router.get("/balance", authMiddleware, async (req, res) => {
  try {
    const balance = await getBalance();

    res.status(200).json({
      message: "Hisob balansi",
      data: balance,
    });
  } catch (error) {
    console.error("Balansni tekshirish xatosi:", error);
    res.status(500).json({
      message: "Balansni tekshirishda xatolik yuz berdi",
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /api/sms/test-connection:
 *   get:
 *     summary: Eskiz API bilan aloqani tekshirish
 *     tags: [SMS]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Aloqa muvaffaqiyatli
 *       401:
 *         description: Avtorizatsiya xatosi
 *       500:
 *         description: Aloqa xatosi
 */
router.get("/test-connection", authMiddleware, async (req, res) => {
  try {
    const isConnected = await testConnection();

    if (isConnected) {
      res.status(200).json({
        message: "Eskiz API bilan aloqa muvaffaqiyatli",
        data: { connected: true },
      });
    } else {
      res.status(500).json({
        message: "Eskiz API bilan aloqada muammo",
        data: { connected: false },
      });
    }
  } catch (error) {
    console.error("Aloqani tekshirish xatosi:", error);
    res.status(500).json({
      message: "Aloqani tekshirishda xatolik yuz berdi",
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /api/sms/check:
 *   post:
 *     summary: SMS xabarini tekshirish
 *     tags: [SMS]
 *     security:
 *       - bearerAuth: []
 *     description: SMS xabarini qora ro'yxat, qismlar soni va narxi bo'yicha tekshirish
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *                 description: Tekshiriladigan SMS matni
 *                 example: "Sizning buyurtmangiz tayyor! Iltimos, 30 daqiqa ichida olib keting."
 *     responses:
 *       200:
 *         description: SMS tekshiruvi muvaffaqiyatli
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "SMS tekshiruvi muvaffaqiyatli"
 *                 data:
 *                   type: object
 *                   properties:
 *                     is_blacklisted:
 *                       type: boolean
 *                       description: Xabar qora ro'yxatda ekanligini ko'rsatadi
 *                     parts:
 *                       type: integer
 *                       description: SMS qismlari soni
 *                     cost:
 *                       type: object
 *                       description: Har bir kompaniya uchun narx ma'lumotlari
 *       400:
 *         description: Xato ma'lumotlar
 *       401:
 *         description: Avtorizatsiya xatosi
 *       500:
 *         description: Server xatosi
 */
router.post("/check", authMiddleware, checkSmsValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: "Validation error",
        errors: errors.array(),
      });
    }

    const { message } = req.body;

    // SMS xabarini tekshirish
    const checkResult = await checkSMSMessage(message);

    res.status(200).json({
      message: "SMS tekshiruvi muvaffaqiyatli",
      data: checkResult.data,
    });
  } catch (error) {
    console.error("SMS tekshirish xatosi:", error);
    res.status(500).json({
      message: "SMS tekshirishda xatolik yuz berdi",
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /api/sms/history:
 *   get:
 *     summary: SMS tarixi
 *     tags: [SMS]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Sahifa raqami
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Bir sahifadagi yozuvlar soni
 *       - in: query
 *         name: phone
 *         schema:
 *           type: string
 *         description: Telefon raqami bo'yicha filter
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Status bo'yicha filter
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *         description: Tur bo'yicha filter
 *     responses:
 *       200:
 *         description: SMS tarixi
 *       401:
 *         description: Avtorizatsiya xatosi
 *       500:
 *         description: Server xatosi
 */
router.get("/history", authMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 20, phone, status, type } = req.query;
    const skip = (page - 1) * limit;

    // Filter ob'ektini tuzish
    const filter = {};
    if (phone) filter.phone = { $regex: phone, $options: "i" };
    if (status) filter.status = status;
    if (type) filter.type = type;

    // SMS'larni olish
    const smsHistory = await SMS.find(filter)
      .populate("sentBy", "fullName phone")
      .sort({ sentAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Umumiy soni
    const total = await SMS.countDocuments(filter);

    res.status(200).json({
      message: "SMS tarixi",
      data: {
        sms: smsHistory,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total: total,
          hasNext: page * limit < total,
          hasPrev: page > 1,
        },
      },
    });
  } catch (error) {
    console.error("SMS tarixini olish xatosi:", error);
    res.status(500).json({
      message: "SMS tarixini olishda xatolik yuz berdi",
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /api/sms/statistics:
 *   get:
 *     summary: SMS statistikasi
 *     tags: [SMS]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Boshlanish sanasi (YYYY-MM-DD)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Tugash sanasi (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: SMS statistikasi
 *       401:
 *         description: Avtorizatsiya xatosi
 *       500:
 *         description: Server xatosi
 */
router.get("/statistics", authMiddleware, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Sanalar uchun filter
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.sentAt = {};
      if (startDate) dateFilter.sentAt.$gte = new Date(startDate);
      if (endDate) dateFilter.sentAt.$lte = new Date(endDate + "T23:59:59");
    }

    // Umumiy statistika
    const [detailedStats] = await SMS.getDetailedStatistics(dateFilter);
    const typeStats = await SMS.getTypeStatistics(dateFilter);

    // Status bo'yicha statistika
    const statusStats = await SMS.aggregate([
      { $match: dateFilter },
      { $group: { _id: "$status", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    // Kunlik statistika (oxirgi 30 kun)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const dailyStats = await SMS.getDailyStats(30);

    // Umumiy xarajat
    const totalCostResult = await SMS.aggregate([
      { $match: dateFilter },
      { $group: { _id: null, totalCost: { $sum: "$cost" } } },
    ]);
    const totalCost =
      totalCostResult.length > 0 ? totalCostResult[0].totalCost : 0;

    res.status(200).json({
      message: "SMS statistikasi",
      data: {
        summary: detailedStats || {
          total: 0,
          pending: 0,
          sent: 0,
          delivered: 0,
          failed: 0,
          totalCost: totalCost,
          totalParts: 0,
          averageParts: 0,
        },
        statusStats: statusStats,
        typeStats: typeStats,
        dailyStats: dailyStats,
      },
    });
  } catch (error) {
    console.error("SMS statistikasini olish xatosi:", error);
    res.status(500).json({
      message: "SMS statistikasini olishda xatolik yuz berdi",
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /api/sms/send-with-callback:
 *   post:
 *     summary: SMS jo'natish callback URL bilan
 *     tags: [SMS]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *               - message
 *             properties:
 *               phone:
 *                 type: string
 *                 description: Telefon raqami (998XXXXXXXXX formatida)
 *                 example: "998901234567"
 *               message:
 *                 type: string
 *                 description: SMS matni
 *                 example: "Sizning buyurtmangiz tayyor!"
 *               from:
 *                 type: string
 *                 description: Jo'natuvchi nomi (ixtiyoriy)
 *                 example: "4546"
 *               callbackUrl:
 *                 type: string
 *                 description: Callback URL (ixtiyoriy)
 *                 example: "https://example.com/sms-callback"
 *     responses:
 *       200:
 *         description: SMS muvaffaqiyatli jo'natildi
 *       400:
 *         description: Xato ma'lumotlar
 *       401:
 *         description: Avtorizatsiya xatosi
 *       500:
 *         description: Server xatosi
 */
router.post(
  "/send-with-callback",
  authMiddleware,
  callbackSmsValidation,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          message: "Validation error",
          errors: errors.array(),
        });
      }

      const { phone, message, from, callbackUrl } = req.body;

      // SMS jo'natish callback URL bilan
      const result = await sendSMSWithCallback(
        phone,
        message,
        from,
        callbackUrl
      );

      // Ma'lumotlarni bazaga saqlash callback URL bilan
      const smsRecord = new SMS({
        phone: result.phone,
        message: result.message,
        messageId: result.message_id,
        status: result.status,
        cost: result.cost,
        parts: result.parts,
        callbackUrl: result.callback_url,
        sentBy: req.admin ? req.admin.id : null,
        sentAt: new Date(),
      });

      await smsRecord.save();

      res.status(200).json({
        message: "SMS muvaffaqiyatli jo'natildi",
        data: result,
      });
    } catch (error) {
      console.error("SMS jo'natish xatosi:", error);
      res.status(500).json({
        message: "SMS jo'natishda xatolik yuz berdi",
        error: error.message,
      });
    }
  }
);

/**
 * @swagger
 * /api/sms/user-info:
 *   get:
 *     summary: Foydalanuvchi ma'lumotlari
 *     tags: [SMS]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Foydalanuvchi ma'lumotlari
 *       401:
 *         description: Avtorizatsiya xatosi
 *       500:
 *         description: Server xatosi
 */
router.get("/user-info", authMiddleware, async (req, res) => {
  try {
    const userInfo = await getUserInfo();

    res.status(200).json({
      message: "Foydalanuvchi ma'lumotlari",
      data: userInfo,
    });
  } catch (error) {
    console.error("Foydalanuvchi ma'lumotlarini olish xatosi:", error);
    res.status(500).json({
      message: "Foydalanuvchi ma'lumotlarini olishda xatolik yuz berdi",
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /api/sms/templates:
 *   get:
 *     summary: Shablonlar ro'yxati
 *     tags: [SMS]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Shablonlar ro'yxati
 *       401:
 *         description: Avtorizatsiya xatosi
 *       500:
 *         description: Server xatosi
 */
router.get("/templates", authMiddleware, async (req, res) => {
  try {
    const templates = await getTemplates();

    res.status(200).json({
      message: "Shablonlar ro'yxati",
      data: templates,
    });
  } catch (error) {
    console.error("Shablonlar ro'yxatini olish xatosi:", error);
    res.status(500).json({
      message: "Shablonlar ro'yxatini olishda xatolik yuz berdi",
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /api/sms/template:
 *   post:
 *     summary: Yangi shablon yaratish
 *     tags: [SMS]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - template
 *             properties:
 *               template:
 *                 type: string
 *                 description: Shablon matni
 *                 example: "Sizning buyurtmangiz #{order_id} tayyor!"
 *     responses:
 *       200:
 *         description: Shablon muvaffaqiyatli yaratildi
 *       400:
 *         description: Xato ma'lumotlar
 *       401:
 *         description: Avtorizatsiya xatosi
 *       500:
 *         description: Server xatosi
 */
router.post(
  "/template",
  authMiddleware,
  templateValidation,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          message: "Validation error",
          errors: errors.array(),
        });
      }

      const { template } = req.body;

      // Shablon yaratish
      const result = await createTemplate(template);

      res.status(200).json({
        message: "Shablon muvaffaqiyatli yaratildi",
        data: result,
      });
    } catch (error) {
      res.status(500).json({
        message:
          error?.response?.data?.data?.message ||
          "Shablon yaratishda xatolik yuz berdi",
        error: error.message,
      });
    }
  }
);

/**
 * @swagger
 * /api/sms/template/{templateId}:
 *   get:
 *     summary: Shablon ID bo'yicha olish
 *     tags: [SMS]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: templateId
 *         required: true
 *         schema:
 *           type: string
 *         description: Shablon ID raqami
 *     responses:
 *       200:
 *         description: Shablon ma'lumotlari
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Shablon muvaffaqiyatli topildi"
 *                 data:
 *                   type: object
 *                   properties:
 *                     template:
 *                       type: string
 *                       description: Shablon matni
 *                     status:
 *                       type: string
 *                       description: "moderation/inproccess/service/reklama/rejected"
 *                     id:
 *                       type: string
 *                       description: Shablon ID
 *       401:
 *         description: Avtorizatsiya xatosi
 *       404:
 *         description: Shablon topilmadi
 *       500:
 *         description: Server xatosi
 */
router.get("/template/:templateId", authMiddleware, async (req, res) => {
  try {
    const { templateId } = req.params;

    if (!templateId) {
      return res.status(400).json({
        message: "Shablon ID majburiy",
      });
    }

    // Shablon ma'lumotlarini olish
    const result = await getTemplateById(templateId);

    res.status(200).json({
      message: "Shablon muvaffaqiyatli topildi",
      data: result.template,
    });
  } catch (error) {
    console.error("Shablon olish xatosi:", error);

    // 404 xatolikni alohida qayta ishlash
    if (error.message.includes("404") || error.message.includes("not found")) {
      return res.status(404).json({
        message: "Shablon topilmadi",
        error: error.message,
      });
    }

    res.status(500).json({
      message: "Shablon olishda xatolik yuz berdi",
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /api/sms/callback:
 *   post:
 *     summary: SMS status callback webhook
 *     tags: [SMS]
 *     description: Eskiz.uz tomonidan yuborilgan callback ma'lumotlarini qabul qilish
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               request_id:
 *                 type: string
 *                 example: "UUID"
 *               message_id:
 *                 type: string
 *                 example: "4385062"
 *               user_sms_id:
 *                 type: string
 *                 example: "vash_ID_zdes"
 *               country:
 *                 type: string
 *                 example: "UZ"
 *               phone_number:
 *                 type: string
 *                 example: "998991234567"
 *               sms_count:
 *                 type: string
 *                 example: "1"
 *               status:
 *                 type: string
 *                 example: "DELIVRD"
 *               status_date:
 *                 type: string
 *                 example: "2021-04-02 00:39:36"
 *     responses:
 *       200:
 *         description: Callback muvaffaqiyatli qabul qilindi
 *       400:
 *         description: Xato ma'lumotlar
 */
router.post("/callback", async (req, res) => {
  try {
    const {
      request_id,
      message_id,
      user_sms_id,
      country,
      phone_number,
      sms_count,
      status,
      status_date,
    } = req.body;

    // Callback ma'lumotlarini log qilish
    console.log("SMS Callback qabul qilindi:", {
      request_id,
      message_id,
      user_sms_id,
      country,
      phone_number,
      sms_count,
      status,
      status_date,
    });

    // Bazadagi SMS yozuvini yangilash
    const updateResult = await SMS.findOneAndUpdate(
      {
        $or: [{ messageId: message_id }, { messageId: request_id }],
      },
      {
        status: status,
        statusNote: `Country: ${country}, SMS Count: ${sms_count}`,
        callbackReceivedAt: new Date(),
        updatedAt: new Date(),
      },
      { new: true }
    );

    if (updateResult) {
      console.log(`SMS ${message_id} holati yangilandi:`, status);
    } else {
      console.warn(`SMS ${message_id} bazada topilmadi`);
    }

    res.status(200).json({
      message: "Callback muvaffaqiyatli qabul qilindi",
      status: "success",
    });
  } catch (error) {
    console.error("Callback xatosi:", error);
    res.status(500).json({
      message: "Callback'ni qayta ishlashda xatolik yuz berdi",
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /api/sms/reports/totals:
 *   post:
 *     summary: Itogo yuborilgan SMS'lar
 *     tags: [SMS]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - year
 *             properties:
 *               year:
 *                 type: integer
 *                 description: Yil
 *                 example: 2024
 *               month:
 *                 type: integer
 *                 description: Oy (ixtiyoriy)
 *                 example: 11
 *               isGlobal:
 *                 type: boolean
 *                 description: Xalqaro SMS'lar (ixtiyoriy)
 *                 example: false
 *     responses:
 *       200:
 *         description: SMS itoglari
 *       400:
 *         description: Xato ma'lumotlar
 *       401:
 *         description: Avtorizatsiya xatosi
 *       500:
 *         description: Server xatosi
 */
router.post(
  "/reports/totals",
  authMiddleware,
  totalsValidation,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          message: "Validation error",
          errors: errors.array(),
        });
      }

      const { year, month, isGlobal } = req.body;

      // Eskiz API dan itoglarni olish
      const totals = await getSMSTotals(year, month, isGlobal);

      res.status(200).json({
        message: "SMS itoglari",
        data: totals,
      });
    } catch (error) {
      console.error("SMS itoglarini olish xatosi:", error);
      res.status(500).json({
        message: "SMS itoglarini olishda xatolik yuz berdi",
        error: error.message,
      });
    }
  }
);

/**
 * @swagger
 * /api/sms/reports/range:
 *   post:
 *     summary: Sanalar bo'yicha xarajatlar
 *     tags: [SMS]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - startDate
 *               - endDate
 *             properties:
 *               startDate:
 *                 type: string
 *                 description: Boshlanish sanasi (YYYY-MM-DD HH:MM)
 *                 example: "2024-01-01 00:00"
 *               endDate:
 *                 type: string
 *                 description: Tugash sanasi (YYYY-MM-DD HH:MM)
 *                 example: "2024-01-31 23:59"
 *               status:
 *                 type: string
 *                 description: Status filter (ixtiyoriy)
 *                 enum: ['', 'delivered', 'rejected']
 *                 example: "delivered"
 *               isAd:
 *                 type: string
 *                 description: SMS turi (ixtiyoriy)
 *                 enum: ['', '0', '1']
 *                 example: "0"
 *     responses:
 *       200:
 *         description: Sanalar bo'yicha xarajatlar
 *       400:
 *         description: Xato ma'lumotlar
 *       401:
 *         description: Avtorizatsiya xatosi
 *       500:
 *         description: Server xatosi
 */
router.post(
  "/reports/range",
  authMiddleware,
  rangeValidation,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          message: "Validation error",
          errors: errors.array(),
        });
      }

      const { startDate, endDate, status = "", isAd = "" } = req.body;

      // Eskiz API dan sanalar bo'yicha ma'lumotlarni olish
      const rangeData = await getTotalsByRange(
        startDate,
        endDate,
        status,
        isAd
      );

      res.status(200).json({
        message: "Sanalar bo'yicha xarajatlar",
        data: rangeData,
      });
    } catch (error) {
      console.error("Sanalar bo'yicha xarajatlarni olish xatosi:", error);
      res.status(500).json({
        message: "Sanalar bo'yicha xarajatlarni olishda xatolik yuz berdi",
        error: error.message,
      });
    }
  }
);

/**
 * @swagger
 * /api/sms/reports/dispatch:
 *   post:
 *     summary: Dispatch bo'yicha xarajatlar
 *     tags: [SMS]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - dispatchId
 *             properties:
 *               dispatchId:
 *                 type: string
 *                 description: Dispatch ID
 *                 example: "123"
 *               status:
 *                 type: string
 *                 description: Status filter (ixtiyoriy)
 *                 enum: ['', 'delivered', 'rejected']
 *                 example: "delivered"
 *               isAd:
 *                 type: string
 *                 description: SMS turi (ixtiyoriy)
 *                 enum: ['', '0', '1']
 *                 example: "0"
 *     responses:
 *       200:
 *         description: Dispatch bo'yicha xarajatlar
 *       400:
 *         description: Xato ma'lumotlar
 *       401:
 *         description: Avtorizatsiya xatosi
 *       500:
 *         description: Server xatosi
 */
router.post(
  "/reports/dispatch",
  authMiddleware,
  dispatchValidation,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          message: "Validation error",
          errors: errors.array(),
        });
      }

      const { dispatchId, status = "", isAd = "" } = req.body;

      // Eskiz API dan dispatch bo'yicha ma'lumotlarni olish
      const dispatchData = await getTotalsByDispatch(dispatchId, status, isAd);

      res.status(200).json({
        message: "Dispatch bo'yicha xarajatlar",
        data: dispatchData,
      });
    } catch (error) {
      console.error("Dispatch bo'yicha xarajatlarni olish xatosi:", error);
      res.status(500).json({
        message: "Dispatch bo'yicha xarajatlarni olishda xatolik yuz berdi",
        error: error.message,
      });
    }
  }
);

/**
 * @swagger
 * /api/sms/reports/summary:
 *   get:
 *     summary: Umumiy hisobot
 *     tags: [SMS]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: year
 *         schema:
 *           type: integer
 *           default: 2024
 *         description: Yil
 *       - in: query
 *         name: month
 *         schema:
 *           type: integer
 *         description: Oy (ixtiyoriy)
 *     responses:
 *       200:
 *         description: Umumiy hisobot
 *       401:
 *         description: Avtorizatsiya xatosi
 *       500:
 *         description: Server xatosi
 */
router.get("/reports/summary", authMiddleware, async (req, res) => {
  try {
    const { year = new Date().getFullYear(), month } = req.query;

    // Parallel ravishda ma'lumotlarni olish
    const [eskizTotals, localStats, balance, userInfo] = await Promise.all([
      getSMSTotals(parseInt(year), month ? parseInt(month) : null),
      SMS.getDetailedStatistics(),
      getBalance(),
      getUserInfo(),
    ]);

    // Sanalar filterni yaratish
    const dateFilter = {};
    if (year) {
      const startOfYear = new Date(year, month ? month - 1 : 0, 1);
      const endOfYear = month
        ? new Date(year, month, 0, 23, 59, 59)
        : new Date(year, 11, 31, 23, 59, 59);

      dateFilter.createdAt = {
        $gte: startOfYear,
        $lte: endOfYear,
      };
    }

    // Mahalliy ma'lumotlar bazasidan statistika
    const localMonthlyStats = await SMS.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: null,
          totalSms: { $sum: 1 },
          totalCost: { $sum: "$cost" },
          totalParts: { $sum: "$parts" },
          delivered: {
            $sum: {
              $cond: [
                { $in: ["$status", ["DELIVERED", "DELIVRD", "delivered"]] },
                1,
                0,
              ],
            },
          },
          failed: {
            $sum: {
              $cond: [
                {
                  $in: [
                    "$status",
                    [
                      "REJECTED",
                      "UNDELIV",
                      "UNDELIVERABLE",
                      "EXPIRED",
                      "REJECTD",
                      "DELETED",
                      "failed",
                    ],
                  ],
                },
                1,
                0,
              ],
            },
          },
          pending: {
            $sum: {
              $cond: [
                { $in: ["$status", ["pending", "NEW", "waiting", "STORED"]] },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    // Oy bo'yicha taqsimot
    const monthlyBreakdown = await SMS.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(year, 0, 1),
            $lte: new Date(year, 11, 31),
          },
        },
      },
      {
        $group: {
          _id: { month: { $month: "$createdAt" } },
          count: { $sum: 1 },
          cost: { $sum: "$cost" },
          delivered: {
            $sum: {
              $cond: [
                { $in: ["$status", ["DELIVERED", "DELIVRD", "delivered"]] },
                1,
                0,
              ],
            },
          },
        },
      },
      { $sort: { "_id.month": 1 } },
    ]);

    res.status(200).json({
      message: "Umumiy hisobot",
      data: {
        period: {
          year: parseInt(year),
          month: month ? parseInt(month) : null,
        },
        eskizData: eskizTotals,
        localData: localMonthlyStats[0] || {
          totalSms: 0,
          totalCost: 0,
          totalParts: 0,
          delivered: 0,
          failed: 0,
          pending: 0,
        },
        monthlyBreakdown: monthlyBreakdown,
        account: {
          balance: balance,
          userInfo: userInfo,
        },
      },
    });
  } catch (error) {
    console.error("Umumiy hisobot olish xatosi:", error);
    res.status(500).json({
      message: "Umumiy hisobotni olishda xatolik yuz berdi",
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /api/sms/debt-reminders/start:
 *   post:
 *     summary: Qarzdor eslatma SMS service'ini ishga tushirish
 *     tags: [SMS]
 *     security:
 *       - bearerAuth: []
 *     description: Avtomatik qarzdor eslatma SMS'larini yuborish servisini ishga tushiradi
 *     responses:
 *       200:
 *         description: Service muvaffaqiyatli ishga tushirildi
 *       500:
 *         description: Server xatosi
 */
router.post("/debt-reminders/start", authMiddleware, async (req, res) => {
  try {
    smsNotificationService.startScheduledTasks();
    
    res.status(200).json({
      message: "Qarzdor eslatma SMS service ishga tushirildi",
      status: smsNotificationService.getStatus()
    });
  } catch (error) {
    console.error("SMS notification service ishga tushirishda xatolik:", error);
    res.status(500).json({
      message: "Service ishga tushirishda xatolik yuz berdi",
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /api/sms/debt-reminders/stop:
 *   post:
 *     summary: Qarzdor eslatma SMS service'ini to'xtatish
 *     tags: [SMS]
 *     security:
 *       - bearerAuth: []
 *     description: Avtomatik qarzdor eslatma SMS'larini yuborish servisini to'xtatadi
 *     responses:
 *       200:
 *         description: Service muvaffaqiyatli to'xtatildi
 *       500:
 *         description: Server xatosi
 */
router.post("/debt-reminders/stop", authMiddleware, async (req, res) => {
  try {
    smsNotificationService.stopScheduledTasks();
    
    res.status(200).json({
      message: "Qarzdor eslatma SMS service to'xtatildi",
      status: smsNotificationService.getStatus()
    });
  } catch (error) {
    console.error("SMS notification service to'xtatishda xatolik:", error);
    res.status(500).json({
      message: "Service to'xtatishda xatolik yuz berdi",
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /api/sms/debt-reminders/status:
 *   get:
 *     summary: Qarzdor eslatma SMS service holati
 *     tags: [SMS]
 *     security:
 *       - bearerAuth: []
 *     description: Avtomatik qarzdor eslatma SMS service holatini ko'rish
 *     responses:
 *       200:
 *         description: Service holati
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 status:
 *                   type: object
 *                   properties:
 *                     isRunning:
 *                       type: boolean
 *                     activeTasks:
 *                       type: array
 *                       items:
 *                         type: string
 *                     nextExecutions:
 *                       type: object
 *       500:
 *         description: Server xatosi
 */
router.get("/debt-reminders/status", authMiddleware, async (req, res) => {
  try {
    const status = smsNotificationService.getStatus();
    
    res.status(200).json({
      message: "SMS notification service holati",
      status: status
    });
  } catch (error) {
    console.error("SMS notification service holatini olishda xatolik:", error);
    res.status(500).json({
      message: "Service holatini olishda xatolik yuz berdi",
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /api/sms/debt-reminders/test:
 *   post:
 *     summary: Qarzdor eslatma SMS'larini test qilish
 *     tags: [SMS]
 *     security:
 *       - bearerAuth: []
 *     description: Qarzdor eslatma SMS'larini manual test qilish (development uchun)
 *     responses:
 *       200:
 *         description: Test muvaffaqiyatli bajarildi
 *       500:
 *         description: Server xatosi
 */
router.post("/debt-reminders/test", authMiddleware, async (req, res) => {
  try {
    await smsNotificationService.testReminders();
    
    res.status(200).json({
      message: "Qarzdor eslatma SMS'lari test qilindi",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("SMS eslatmalarini test qilishda xatolik:", error);
    res.status(500).json({
      message: "SMS eslatmalarini test qilishda xatolik yuz berdi",
      error: error.message,
    });
  }
});

module.exports = router;
