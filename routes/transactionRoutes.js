const express = require("express");
const router = express.Router();
const Transaction = require("../models/transactions/transaction.model");
const Client = require("../models/clients/client.model");

// 📊 Oylik kirim/chiqim statistikasi
router.get("/", async (req, res) => {
  try {
    const result = await Transaction.find({ isDeleted: false })
      .populate("client");
    res.json({
      transactions: result,
    });
  } catch (error) {
    res.status(500).json({ message: "Statistika olishda xatolik", error });
  }
});

// ➕ Kirim
router.post("/cash-in", async (req, res) => {
  try {
    let { amount, paymentType, description, branch, createdBy, client } =
      req.body;
    // amount should be a number
    amount = Number(amount) || 0;
    if (amount < 0) {
      return res
        .status(400)
        .json({ message: "amount musbat bo'lishi kerak" });
    }
    const isClient = client ? await Client.findById(client) : null;
    if (isClient) {
      isClient.debt -= amount;
      await isClient.save();
    }
    const transaction = await Transaction.create({
      type: "cash-in",
      amount,
      paymentType,
      description,
      branch,
      createdBy,
      client,
    });
    res.status(201).json(transaction);
  } catch (error) {
    res.status(500).json({ message: "Kirimni qo‘shishda xatolik", error });
  }
});

// ➖ Chiqim
router.post("/cash-out", async (req, res) => {
  try {
    let { amount, paymentType, description, branch, createdBy, client } =
      req.body;
    amount = Number(amount) || 0;
    if (amount < 0) {
      return res
        .status(400)
        .json({ message: "amount musbat bo'lishi kerak" });
    }
    const isClient = client ? await Client.findById(client) : null;
    if (isClient) {
      isClient.debt += amount;
      await isClient.save();
    }
    const transaction = await Transaction.create({
      type: "cash-out",
      amount,
      paymentType,
      description,
      branch,
      createdBy,
      client,
    });
    res.status(201).json(transaction);
  } catch (error) {
    res.status(500).json({ message: "Chiqimni qo‘shishda xatolik", error });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const transactionId = req.params.id;
    let { amount, paymentType, description, branch, createdBy, client } =
      req.body;
    amount = Number(amount) || 0;
    if (amount < 0) {
      return res
        .status(400)
        .json({ message: "amount musbat bo'lishi kerak" });
    }
    const transaction = await Transaction.findById(transactionId);
    if (!transaction || transaction.isDeleted) {
      return res.status(404).json({ message: "Transaction topilmadi" });
    }
    // Обновление долга клиента, если client меняется
    if (client && client !== String(transaction.client)) {
      const oldClient = await Client.findById(transaction.client);
      if (oldClient) {
        if (transaction.type === "cash-in") {
          oldClient.debt += transaction.amount;
        } else if (transaction.type === "cash-out") {
          oldClient.debt -= transaction.amount;
        }
        await oldClient.save();
      }
      const newClient = await Client.findById(client);
      if (newClient) {
        if (transaction.type === "cash-in") {
          newClient.debt -= amount;
        } else if (transaction.type === "cash-out") {
          newClient.debt += amount;
        }
        await newClient.save();
      }
      transaction.client = client;
    } else if (client) {
      // Если client не меняется, обновить долг по новой сумме
      const curClient = await Client.findById(client);
      if (curClient) {
        if (transaction.type === "cash-in") {
          curClient.debt += transaction.amount - amount;
        } else if (transaction.type === "cash-out") {
          curClient.debt -= transaction.amount - amount;
        }
        await curClient.save();
      }
    }
    transaction.amount = amount;
    transaction.paymentType = paymentType;
    transaction.description = description;
    // Removed branch assignment
    transaction.createdBy = createdBy;
    await transaction.save();
    res.json(transaction);
  } catch (error) {
    res.status(500).json({ message: "Transaction yangilashda xatolik", error });
  }
});
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const transaction = await Transaction.findByIdAndDelete(id);
    console.log(id);
    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found" });
    }
    return res.status(200).json({ message: "Transaction o`chirildi" });
  } catch (error) {
    res.status(500).json({ message: "Transaction yangilashda xatolik", error });
  }
});
// 📊 Oylik kirim/chiqim statistikasi
router.get("/statistics/monthly-transactions", async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const match = {
      createdAt: {
        $gte: new Date(`${year}-01-01T00:00:00.000Z`),
        $lt: new Date(`${year + 1}-01-01T00:00:00.000Z`),
      },
    };
    const pipeline = [
      { $match: match },
      {
        $project: {
          month: { $month: "$createdAt" },
          type: 1,
          amount: 1,
        },
      },
      {
        $group: {
          _id: { month: "$month", type: "$type" },
          total: { $sum: "$amount" },
        },
      },
    ];
    const result = await Transaction.aggregate(pipeline);
    const cashIn = Array(12).fill(0);
    const cashOut = Array(12).fill(0);
    result.forEach((item) => {
      const index = item._id.month - 1;
      if (item._id.type === "cash-in") {
        cashIn[index] = item.total;
      } else if (item._id.type === "cash-out") {
        cashOut[index] = item.total;
      }
    });
    res.json({ cashIn, cashOut });
  } catch (error) {
    res.status(500).json({ message: "Statistika olishda xatolik", error });
  }
});

/**
 * @swagger
 * tags:
 *   name: Transaction
 *   description: Финансовые транзакции
 */

/**
 * @swagger
 * /api/transactions:
 *   get:
 *     summary: Получить список транзакций
 *     tags: [Transaction]
 *     responses:
 *       200:
 *         description: Список транзакций
 */

/**
 * @swagger
 * /api/transactions/cash-in:
 *   post:
 *     summary: Добавить приход (cash-in)
 *     tags: [Transaction]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amount:
 *                 type: number
 *                 example: 1200000
 *               paymentType:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Приход добавлен
 *       400:
 *         description: Ошибка валидации
 */

/**
 * @swagger
 * /api/transactions/cash-out:
 *   post:
 *     summary: Добавить расход (cash-out)
 *     tags: [Transaction]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amount:
 *                 type: number
 *                 example: 1200000
 *               paymentType:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Расход добавлен
 *       400:
 *         description: Ошибка валидации
 */

/**
 * @swagger
 * /api/transactions/{id}:
 *   put:
 *     summary: Обновить транзакцию по ID
 *     tags: [Transaction]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID транзакции
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Транзакция обновлена
 *       404:
 *         description: Транзакция не найдена
 */

/**
 * @swagger
 * /api/transactions/statistics/monthly-transactions:
 *   get:
 *     summary: Получить месячную статистику по транзакциям
 *     tags: [Transaction]
 *     parameters:
 *       - in: query
 *         name: year
 *         schema:
 *           type: integer
 *         description: Год
 *       - in: query
 *         name: branch
 *         schema:
 *           type: string
 *         description: ID филиала
 *     responses:
 *       200:
 *         description: Месячная статистика
 */

module.exports = router;
