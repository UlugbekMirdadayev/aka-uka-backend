const express = require("express");
const router = express.Router();
const Debtor = require("../models/debtors/debtor.model");
const Transaction = require("../models/transactions/transaction.model");
const Client = require("../models/clients/client.model");
const authMiddleware = require("../middleware/authMiddleware");
const { body, validationResult } = require("express-validator");

/**
 * @swagger
 * tags:
 *   name: Debtors
 *   description: Qarzdorlar boshqaruvi
 */

// Debtor validation
const debtorValidation = [
  body("client").isMongoId().withMessage("Noto'g'ri mijoz ID"),
  body("currentDebt").isNumeric().withMessage("currentDebt raqam bo'lishi kerak"),
  body("initialDebt")
    .optional()
    .isNumeric()
    .withMessage("initialDebt raqam bo'lishi kerak"),
  body("nextPayment.amount")
    .optional()
    .isNumeric()
    .withMessage("nextPayment.amount raqam bo'lishi kerak"),
  body("nextPayment.dueDate")
    .optional({ nullable: true })
    .isISO8601()
    .withMessage("Noto'g'ri sana formati"),
  body("description").optional().trim(),
];

/**
 * @swagger
 * /api/debtors:
 *   post:
 *     summary: Yangi qarzdor yaratish
 *     tags: [Debtors]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - client
 *               - currentDebt
 *             properties:
 *               client:
 *                 type: string
 *                 description: Mijoz ID
 *               currentDebt:
 *                 type: number
 *                 description: Qarz miqdori
 *                 minimum: 0
 *               initialDebt:
 *                 type: number
 *                 description: "Boshlang'ich qarz miqdori (ixtiyoriy)"
 *                 minimum: 0
 *               nextPayment:
 *                 type: object
 *                 description: Keyingi to'lov ma'lumotlari (ixtiyoriy)
 *                 properties:
 *                   amount:
 *                     type: number
 *                     minimum: 0
 *                     description: "To'lov miqdori"
 *                   dueDate:
 *                     type: string
 *                     format: date
 *                     description: To'lov muddati
 *               description:
 *                 type: string
 *                 description: Qo'shimcha izoh
 *     responses:
 *       201:
 *         description: Qarzdor muvaffaqiyatli yaratildi
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Debtor'
 *       400:
 *         description: Validation xatosi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: object
 *       404:
 *         description: Mijoz topilmadi
 *       500:
 *         description: Server xatosi
 */

// POST /debtors - Yangi qarzdor yaratish
router.post("/", authMiddleware, debtorValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      client,
      currentDebt,
      initialDebt = currentDebt,
      nextPayment,
      description,
    } = req.body;

    // Mijozni tekshirish
    const clientExists = await Client.findById(client);
    if (!clientExists) {
      return res.status(404).json({ message: "Mijoz topilmadi" });
    }

    const debtor = new Debtor({
      client,
      currentDebt,
      initialDebt,
      initialDebtDate: new Date(),
      totalPaid: 0,
      nextPayment: nextPayment || {},
      description: description || "",
    });

    await debtor.save();

    // Debt yaratish Transaction'ini qo'shish
    try {
      await Transaction.create({
        type: "debt-created",
        amount: currentDebt,
        paymentType: "debt",
        description: `Qarzdor yaratildi - ${description || "Yangi qarz"}`,
        relatedModel: "Debtor",
        relatedId: debtor._id,
        client: client,
        // branch field removed
        createdBy: req.user?.id || null,
      });
    } catch (transactionError) {
      console.error(
        "Transaction yaratishda xatolik:",
        transactionError.message
      );
    }

    // Mijozning umumiy qarzini yangilash
    const clientDoc = await Client.findById(client);
    if (clientDoc) {
      clientDoc.debt = (clientDoc.debt || 0) + (currentDebt || 0);
      await clientDoc.save();
    }

    const populatedDebtor = await Debtor.findById(debtor._id).populate(
      "client"
    );
    res.status(201).json(populatedDebtor);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * @swagger
 * /api/debtors:
 *   get:
 *     summary: Qarzdorlar ro'yxati
 *     tags: [Debtors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: client
 *         schema:
 *           type: string
 *         description: Mijoz ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, partial, paid, overdue]
 *         description: Qarzdor holati
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Yaratilish sanasi boshlanish nuqtasi
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Yaratilish sanasi tugash nuqtasi
 *     responses:
 *       200:
 *         description: Qarzdorlar ro'yxati muvaffaqiyatli qaytarildi
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Debtor'
 *       500:
 *         description: Server xatosi
 */

// GET /debtors - Qarzdorlar ro'yxati
router.get("/", async (req, res) => {
  try {
    const { client, status, startDate, endDate } = req.query;

    let query = { isDeleted: false };
    if (client) query.client = client;
    if (status) query.status = status;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const debtors = await Debtor.find(query)
      .populate("client")
      .sort({ createdAt: -1 });

    res.json(debtors);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * @swagger
 * /api/debtors/{id}:
 *   get:
 *     summary: Биттa қарзҳор маълумотларини олиш
 *     tags: [Debtors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Qarzdor ID
 *     responses:
 *       200:
 *         description: Qarzdor ma'lumotlari muvaffaqiyatli qaytarildi
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Debtor'
 *       404:
 *         description: Qarzdor topilmadi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Qarzdor topilmadi"
 *       500:
 *         description: Server xatosi
 */

// GET /debtors/:id - Qarzdor ma'lumotlari
router.get("/:id", async (req, res) => {
  try {
    const debtor = await Debtor.findOne({
      _id: req.params.id,
      isDeleted: false,
    }).populate("client");

    if (!debtor) {
      return res.status(404).json({ message: "Qarzdor topilmadi" });
    }

    res.json(debtor);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * @swagger
 * /api/debtors/{id}/payment:
 *   post:
 *     summary: Qarz to'lovi qilish
 *     tags: [Debtors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Qarzdor ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - payment
 *             properties:
 *               payment:
 *                 type: number
 *                 description: To'lov miqdori
 *                 minimum: 0
 *               nextPayment:
 *                 type: object
 *                 description: Keyingi to'lov ma'lumotlari (ixtiyoriy)
 *                 properties:
 *                   amount:
 *                     type: number
 *                     minimum: 0
 *                   dueDate:
 *                     type: string
 *                     format: date
 *                     description: Keyingi to'lov muddati
 *     responses:
 *       200:
 *         description: To'lov muvaffaqiyatli amalga oshirildi
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Debtor'
 *       400:
 *         description: Noto'g'ri to'lov ma'lumotlari
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       404:
 *         description: Qarzdor topilmadi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Qarzdor topilmadi"
 *       500:
 *         description: Server xatosi
 */

// POST /debtors/:id/payment - Qarz to'lovi
router.post("/:id/payment", authMiddleware, async (req, res) => {
  try {
    const { payment, nextPayment } = req.body;

    if (
      !payment ||
      typeof payment !== "number"
    ) {
      return res.status(400).json({
        message: "To'lov miqdori raqam bo'lishi kerak",
      });
    }

    const debtor = await Debtor.findOne({
      _id: req.params.id,
      isDeleted: false,
    });

    if (!debtor) {
      return res.status(404).json({ message: "Qarzdor topilmadi" });
    }

    // Joriy qarzdan to'lovni ayirish
    debtor.currentDebt = Math.max(0, debtor.currentDebt - payment);

    // Umumiy to'lovga qo'shish
    debtor.totalPaid += payment;

    // Oxirgi to'lovni yangilash
    debtor.lastPayment = {
      amount: payment,
      date: new Date(),
    };

    // Keyingi to'lovni o'rnatish (agar berilgan bo'lsa)
    if (nextPayment) {
      debtor.nextPayment = {
        amount: Number(nextPayment.amount) || 0,
        dueDate: nextPayment.dueDate
      };
    }

    await debtor.save();

    // To'lov Transaction'ini qo'shish
    try {
      await Transaction.create({
        type: "debt-payment",
        amount: payment,
        paymentType: "cash", // Default, kerak bo'lsa req.body'dan olish mumkin
        description: `Qarz to'lovi - Debtor #${debtor._id}`,
        relatedModel: "Debtor",
        relatedId: debtor._id,
        client: debtor.client,
        // branch field removed
        createdBy: req.user?.id || null,
      });
    } catch (transactionError) {
      console.error(
        "Transaction yaratishda xatolik:",
        transactionError.message
      );
    }

    // Mijozning umumiy qarzini yangilash
    const client = await Client.findById(debtor.client);
    if (client) {
      client.debt = (client.debt || 0) - payment;
      await client.save();
    }

    const updatedDebtor = await Debtor.findById(debtor._id).populate("client");
    res.json(updatedDebtor);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * @swagger
 * /api/debtors/{id}:
 *   patch:
 *     summary: Qarzdor ma'lumotlarini yangilash
 *     tags: [Debtors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Qarzdor ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nextPayment:
 *                 type: object
 *                 description: Keyingi to'lov ma'lumotlari
 *                 properties:
 *                   amount:
 *                     type: number
 *                     minimum: 0
 *                     description: "To'lov miqdori"
 *                   dueDate:
 *                     type: string
 *                     format: date
 *                     description: Keyingi to'lov muddati
 *               description:
 *                 type: string
 *                 description: Qo'shimcha izoh
 *     responses:
 *       200:
 *         description: Ma'lumotlar muvaffaqiyatli yangilandi
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Debtor'
 *       404:
 *         description: Qarzdor topilmadi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Qarzdor topilmadi"
 *       500:
 *         description: Server xatosi
 */

// PATCH /debtors/:id - Qarzdor ma'lumotlarini yangilash
router.patch("/:id", authMiddleware, async (req, res) => {
  try {
    const debtor = await Debtor.findOne({
      _id: req.params.id,
      isDeleted: false,
    });

    if (!debtor) {
      return res.status(404).json({ message: "Qarzdor topilmadi" });
    }

    const { nextPayment, description, ...updates } = req.body;

    if (nextPayment) debtor.nextPayment = nextPayment;
    if (description !== undefined) debtor.description = description;

    Object.assign(debtor, updates);
    await debtor.save();

    // --- Обновляем долг клиента ---
    const clientId = debtor.client;
    if (clientId) {
      // Суммируем все активные долги клиента
      const allDebts = await Debtor.find({ client: clientId, isDeleted: false });
      let totalDebt = 0;
      for (const d of allDebts) {
        totalDebt += d.currentDebt || 0;
      }
      await Client.findByIdAndUpdate(clientId, {
        $set: { debt: totalDebt }
      });
    }
    // --- конец обновления ---

    const updatedDebtor = await Debtor.findById(debtor._id).populate("client");
    res.json(updatedDebtor);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * @swagger
 * /api/debtors/{id}:
 *   delete:
 *     summary: Qarzdorni o'chirish (soft delete)
 *     description: Qarzdorni bazadan butunlay o'chirmasdan, faqat isDeleted flagini true qiladi
 *     tags: [Debtors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Qarzdor ID
 *     responses:
 *       200:
 *         description: Qarzdor muvaffaqiyatli o'chirildi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Qarzdor o'chirildi"
 *       404:
 *         description: Qarzdor topilmadi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Qarzdor topilmadi"
 *       500:
 *         description: Server xatosi
 */

// DELETE /debtors/:id - Qarzdorni o'chirish (soft delete)
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const debtor = await Debtor.findOne({
      _id: req.params.id,
      isDeleted: false,
    });

    if (!debtor) {
      return res.status(404).json({ message: "Qarzdor topilmadi" });
    }

    // Mijozning umumiy qarzidan айириш
    const clientDoc = await Client.findById(debtor.client);
    if (clientDoc) {
      clientDoc.debt = (clientDoc.debt || 0) - (debtor.currentDebt || 0);
      await clientDoc.save();

      // --- debtni 0 ga o'rnatish ---
      await Client.findByIdAndUpdate(debtor.client, {
        $set: { debt: 0 }
      });
      // --- end ---
    }

    // Soft delete
    debtor.isDeleted = true;
    debtor.deletedAt = new Date();
    await debtor.save();

    res.json({ message: "Qarzdor o'chirildi" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * @swagger
 * /api/debtors/stats/summary:
 *   get:
 *     summary: Qarzdorlik statistikasi
 *     description: Umumiy qarzdorlik holati bo'yicha statistik ma'lumotlar
 *     tags: [Debtors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Yaratilish sanasi boshlanish nuqtasi
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Yaratilish sanasi tugash nuqtasi
 *     responses:
 *       200:
 *         description: Statistik ma'lumotlar muvaffaqiyatli qaytarildi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalCurrentDebt:
 *                   type: number
 *                   description: "Umumiy joriy qarz miqdori"
 *                 totalPaid:
 *                   type: number
 *                   description: "Umumiy to'langan qarz miqdori"
 *                 statusCounts:
 *                   type: object
 *                   description: Har bir status bo'yicha qarzdorlar soni
 *                   properties:
 *                     pending:
 *                       type: number
 *                       description: Kutilayotgan to'lovlar soni
 *                     partial:
 *                       type: number
 *                       description: Qisman to'langan qarzlar soni
 *                     paid:
 *                       type: number
 *                       description: To'liq to'langan qarzlar soni
 *                     overdue:
 *                       type: number
 *                       description: Muddati o'tgan qarzlar soni
 *                 totalDebtors:
 *                   type: number
 *                   description: Umumiy qarzdorlar soni
 *       500:
 *         description: Server xatosi
 */

// GET /debtors/stats/summary - Qarzdorlik statistikasi
router.get("/stats/summary", async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    let match = { isDeleted: false };
    if (startDate || endDate) {
      match.createdAt = {};
      if (startDate) match.createdAt.$gte = new Date(startDate);
      if (endDate) match.createdAt.$lte = new Date(endDate);
    }

    const debtors = await Debtor.find(match);

    let totalCurrentDebt = 0;
    let totalPaid = 0;
    let statusCounts = {
      pending: 0,
      partial: 0,
      paid: 0,
      overdue: 0,
    };

    for (const debtor of debtors) {
      totalCurrentDebt += debtor.currentDebt || 0;
      totalPaid += debtor.totalPaid || 0;
      statusCounts[debtor.status]++;
    }

    const stats = {
      totalCurrentDebt,
      totalPaid,
      statusCounts,
      totalDebtors: debtors.length,
    };

    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * @swagger
 * components:
 *   schemas:
 *     Client:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: Mijoz ID
 *         fullName:
 *           type: string
 *           description: Mijozning to'liq ismi
 *         phone:
 *           type: string
 *           description: Telefon raqami
 *         cars:
 *           type: array
 *           description: Mijoz mashinalari
 *           items:
 *             type: object
 *             properties:
 *               model:
 *                 type: string
 *               plateNumber:
 *                 type: string
 *               dailyKm:
 *                 type: number
 *               monthlyKm:
 *                 type: number

 *           default: false
 *         debt:
 *           type: object
 *           description: Mijoz qarzi
 *           properties:
 *             usd:
 *               type: number
 *               minimum: 0
 *             uzs:
 *               type: number
 *               minimum: 0
 *         partialPayments:
 *           type: array
 *           description: Qisman to'lovlar tarixi
 *           items:
 *             type: object
 *             properties:
 *               amount:
 *                 type: number
 *               date:
 *                 type: string
 *                 format: date-time
 *         notes:
 *           type: string
 *           description: Qo'shimcha eslatmalar
 *         birthday:
 *           type: string
 *           format: date
 *           nullable: true
 *           description: Tug'ilgan kun
 *         password:
 *           type: string
 *           description: Parol
 *           default: "123456"
 *         isDeleted:
 *           type: boolean
 *           description: O'chirilgan holati
 *           default: false
 *         deletedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: O'chirilgan sana
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Yaratilgan sana
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Oxirgi yangilanish sanasi
 *     Debtor:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: Qarzdor ID
 *         client:
 *           $ref: '#/components/schemas/Client'
 *         currentDebt:
 *           type: number
 *           description: "Joriy qarz miqdori"
 *           minimum: 0
 *         initialDebt:
 *           type: number
 *           description: "Boshlang'ich qarz miqdori"
 *           minimum: 0
 *         initialDebtDate:
 *           type: string
 *           format: date-time
 *           description: Qarzning birinchi marta yaratilgan sanasi
 *         totalPaid:
 *           type: object
 *           description: Umumiy to'langan miqdor
 *           properties:
 *             usd:
 *               type: number
 *               minimum: 0
 *             uzs:
 *               type: number
 *               minimum: 0
 *         lastPayment:
 *           type: object
 *           description: Oxirgi to'lov ma'lumotlari
 *           properties:
 *             amount:
 *               type: object
 *               properties:
 *                 usd:
 *                   type: number
 *                   minimum: 0
 *                 uzs:
 *                   type: number
 *                   minimum: 0
 *             date:
 *               type: string
 *               format: date-time
 *               nullable: true
 *         nextPayment:
 *           type: object
 *           description: Keyingi to'lov rejasi
 *           properties:
 *             amount:
 *               type: object
 *               properties:
 *                 usd:
 *                   type: number
 *                   minimum: 0
 *                 uzs:
 *                   type: number
 *                   minimum: 0
 *             dueDate:
 *               type: string
 *               format: date
 *               nullable: true
 *         description:
 *           type: string
 *           description: Qo'shimcha izoh
 *         status:
 *           type: string
 *           enum: [pending, partial, paid, overdue]
 *           description: Qarzdor holati
 *         isDeleted:
 *           type: boolean
 *           description: O'chirilgan holati
 *           default: false
 *         deletedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: O'chirilgan sana
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Yaratilgan sana
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Oxirgi yangilanish sanasi
 */

module.exports = router;
