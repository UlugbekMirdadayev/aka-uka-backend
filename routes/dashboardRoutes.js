/**
 * @swagger
 * tags:
 *   name: Dashboard
 *   description: Dashboard статистикаси
 */

/**
 * @swagger
 * /api/dashboard/summary:
 *   get:
 *     summary: Dashboard учун барча метрикаларни олиш (top cards, графиклар, топ махсулотлар)
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startofMonth
 *         schema:
 *           type: string
 *           format: date
 *         description: Ой бошланиш санаси
 *       - in: query
 *         name: endofManth
 *         schema:
 *           type: string
 *           format: date
 *         description: Ой тугаш санаси
 *     responses:
 *       200:
 *         description: Dashboard маълумотлари
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 topCards:
 *                   type: object
 *                   properties:
 *                     todayIncome:
 *                       type: number
 *                       description: Буонги даромад
 *                     monthlyIncome:
 *                       type: number
 *                       description: Ойлик даромад
 *                     stockCount:
 *                       type: integer
 *                       description: Омборда мавжуд махсулотлар сони
 *                     lowStockProducts:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           name:
 *                             type: string
 *                           quantity:
 *                             type: number
 *                       description: Кам қолган махсулотлар
 *                     productCapital:
 *                       type: number
 *                       description: Махсулотлар капитали
 *                     totalDebts:
 *                       type: number
 *                       description: Умумий қарзлар
 *                     newClientsCount:
 *                       type: integer
 *                       description: Буонги янги мижозлар
 *                     totalClientsCount:
 *                       type: integer
 *                       description: Жами мижозлар
 *                     totalDebtorsCount:
 *                       type: integer
 *                       description: Жами қарздорлар
 *                 charts:
 *                   type: object
 *                   properties:
 *                     weeklyIncome:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           date:
 *                             type: string
 *                             format: date-time
 *                           total:
 *                             type: number
 *                       description: Ҳафталик даромад графиги
 *                 topProducts:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       count:
 *                         type: number
 *                       totalAmount:
 *                         type: number
 *                   description: Топ махсулотлар
 *       500:
 *         description: Сервер хатоси
 */

const express = require("express");
const router = express.Router();
const Transaction = require("../models/transactions/transaction.model");
const Product = require("../models/products/product.model");
const Client = require("../models/clients/client.model");
const Debtor = require("../models/debtors/debtor.model");

// Ҳафталик даромадни Transaction'лардан олиш
async function getWeeklyIncomeFromTransactions() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const day = new Date(now);
    day.setDate(now.getDate() - i);
    days.push(day);
  }

  const result = [];
  for (let i = 0; i < days.length; i++) {
    const start = days[i];
    const end = new Date(start);
    end.setDate(start.getDate() + 1);

    const dayIncome = await Transaction.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lt: end },
          type: { $in: ["cash-in", "order", "debt-payment"] },
          isDeleted: false,
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
        },
      },
    ]);

    result.push({
      date: start,
      total: dayIncome[0]?.total || 0,
    });
  }
  return result;
}

// Dashboard учун асосий route
router.get("/summary", async (req, res) => {
  try {
    let { startofMonth, endofManth } = req.query;

    // Агар саналар берилмаган бўлса, жорий ойни олиш
    if (!startofMonth || !endofManth) {
      const now = new Date();
      startofMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      endofManth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    } else {
      startofMonth = new Date(startofMonth);
      endofManth = new Date(endofManth);
    }

    // Вақт оралигини белгилаш
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    // Ҳафталик даромад (Transaction'лардан)
    const weeklyIncome = await getWeeklyIncomeFromTransactions();

    // Буонги даромад (Transaction'лардан)
    const todayIncomeAgg = await Transaction.aggregate([
      {
        $match: {
          createdAt: { $gte: today, $lt: tomorrow },
          type: { $in: ["cash-in", "order", "debt-payment"] },
          isDeleted: false,
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
        },
      },
    ]);

    const todayIncome = todayIncomeAgg[0]?.total || 0;

    // Ойлик даромад (Transaction'лардан)
    const monthlyIncomeAgg = await Transaction.aggregate([
      {
        $match: {
          createdAt: { $gte: startofMonth, $lt: endofManth },
          type: { $in: ["cash-in", "order", "debt-payment"] },
          isDeleted: false,
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
        },
      },
    ]);

    const monthlyIncome = monthlyIncomeAgg[0]?.total || 0;

    // Параллел равишда бошқа маълумотларни олиш
    const [
      stockCount,
      lowStockProducts,

      // Мижозлар ҳақида маълумот
      totalClientsCount,
      newClientsCount,

      // Қарздорлар сони
      debtorsCount,

      // Қарз миқдори
      debtsAgg,
    ] = await Promise.all([
      // Махсулотлар сони
      Product.countDocuments({
        quantity: { $gt: 0 },
        isDeleted: { $ne: true },
      }),

      // Кам қолган махсулотлар 10 та
      Product.find({ quantity: { $lt: 5 }, isDeleted: { $ne: true } })
        .select("name quantity")
        .sort({ quantity: 1 })
        .limit(20),

      // Умумий мижозлар сони
      Client.countDocuments({}),

      // Бугунги мижозлар сони
      Client.countDocuments({
        createdAt: { $gte: today, $lt: tomorrow },
      }),

      // Қарздорлар сони
      Debtor.countDocuments({
        isDeleted: { $ne: true },
        currentDebt: { $gt: 0 },
      }),

      // Умумий қарзлар
      Debtor.aggregate([
        { 
          $match: { 
            isDeleted: { $ne: true }, 
            currentDebt: { $gt: 0 }
          } 
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$currentDebt" },
          },
        },
      ]),
    ]);

    // Расчет общей стоимости продуктов (без филиалов)
    const productCapitalAgg = await Product.aggregate([
      { $match: { isDeleted: { $ne: true } } },
      {
        $group: {
          _id: "$currency",
          capital: { $sum: { $multiply: ["$costPrice", "$quantity"] } },
        },
      },
    ]);

    // Обработка результата агрегации для стоимости продуктов
    const productCapital = productCapitalAgg[0]?.capital || 0;

    // Умумий қарзлар
    const totalDebts = debtsAgg[0]?.total || 0;

    // Топ махсулотлар (Transaction'лар орқали)
    const topProductsFromTransactions = await Transaction.aggregate([
      {
        $match: {
          type: "order",
          isDeleted: { $ne: true },
          createdAt: { $gte: startofMonth, $lt: endofManth },
        },
      },
      {
        $group: {
          _id: "$relatedId",
          count: { $sum: 1 },
          totalAmount: {
            $sum: "$amount",
          },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    // Response форматини яратиш
    const topCards = {
      todayIncome,
      monthlyIncome,
      stockCount,
      lowStockProducts,
      productCapital,

      // Мижозлар сони
      clients: {
        total: totalClientsCount,
        new: newClientsCount,
      },

      // Қарздорлар
      debtors: {
        count: debtorsCount,
        amount: totalDebts,
      },
    };

    const charts = {
      weeklyIncome
    };

    res.json({
      success: true,
      data: {
        topCards,
        charts,
        topProducts: topProductsFromTransactions,
      },
    });
  } catch (e) {
    res.status(500).json({
      success: false,
      message: "Dashboard summary olishda xatolik",
      error: e.message,
    });
  }
});

module.exports = router;
