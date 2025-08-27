const express = require("express");
const router = express.Router();
const Client = require("../models/clients/client.model");
const authMiddleware = require("../middleware/authMiddleware");
const { body, validationResult } = require("express-validator");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

/**
 * @swagger
 * tags:
 *   name: Client
 *   description: Клиенты
 */

/**
 * @swagger
 * /api/clients/login:
 *   post:
 *     summary: Вход клиента
 *     tags: [Client]
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
 *       404:
 *         description: Клиент не найден
 */

/**
 * @swagger
 * /api/clients:
 *   post:
 *     summary: Создать нового клиента
 *     tags: [Client]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullName:
 *                 type: string
 *               phone:
 *                 type: string
 *               password:
 *                 type: string
 *               birthday:
 *                 type: string
 *                 format: date
 *               notes:
 *                 type: string
 *               cars:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     model:
 *                       type: string
 *                     plateNumber:
 *                       type: string
 *     responses:
 *       201:
 *         description: Клиент создан
 *       400:
 *         description: Ошибка валидации
 */

/**
 * @swagger
 * /api/clients:
 *   get:
 *     summary: Получить список клиентов
 *     tags: [Client]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Поиск по имени или телефону
 *     responses:
 *       200:
 *         description: Список клиентов
 */

/**
 * @swagger
 * /api/clients/{id}:
 *   get:
 *     summary: Получить клиента по ID
 *     tags: [Client]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID клиента
 *     responses:
 *       200:
 *         description: Клиент найден
 *       404:
 *         description: Клиент не найден
 *   patch:
 *     summary: Обновить клиента по ID
 *     tags: [Client]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID клиента
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Клиент обновлен
 *       404:
 *         description: Клиент не найден
 *   delete:
 *     summary: Удалить клиента по ID
 *     tags: [Client]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID клиента
 *     responses:
 *       200:
 *         description: Клиент удален
 *       404:
 *         description: Клиент не найден
 */

// Валидация для создания/обновления клиента
const clientValidation = [
  body("fullName").trim().notEmpty().withMessage("Имя обязательно"),
  body("phone").trim().notEmpty().withMessage("Телефон обязателен"),
  body("password")
    .optional({ nullable: true })
    .notEmpty()
    .withMessage("Пароль обязателен"),
  body("birthday")
    .optional({
      nullable: true,
    })
    .isISO8601()
    .withMessage("Неверный формат даты"),
  // branch field validation removed
  body("notes").optional().trim(),
  body("cars")
    .optional()
    .isArray()
    .withMessage("Список автомобилей должен быть массивом"),
  body("cars.*.model")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Модель автомобиля обязательна"),
  body("cars.*.plateNumber")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Номер автомобиля обязателен"),
];

router.post(
  "/login",
  [
    body("phone").trim().notEmpty().withMessage("Telefon raqami majburiy"),
    body("password").notEmpty().withMessage("Parol majburiy"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    let { phone, password } = req.body;
    phone = phone.replace(/\s+/g, ""); // Удаляем пробелы из номера телефона
    phone = phone.replace(/\D/g, ""); // Удаляем все нецифровые символы
    if (!phone.startsWith("998")) {
      phone = `998${phone}`;
    }
    try {
      const client = await Client.findOne({ phone });
      if (!client) {
        return res.status(404).json({ message: "Foydalanuvchi topilmadi" });
      }
      const isMatch = await bcrypt.compare(password, client.password);
      if (!isMatch) {
        return res.status(400).json({ message: "Noto‘g‘ri parol" });
      }
      const token = jwt.sign(
        { id: client._id, phone: client.phone },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );
      const { password: p, ...clientWithoutPassword } = client.toObject();
      res.json({
        message: "Tizimga muvaffaqiyatli kirildi",
        token,
        client: clientWithoutPassword,
      });
    } catch (err) {
      console.error("Login xatosi:", err);
      res.status(500).json({ message: "Serverda xatolik" });
    }
  }
);

// Добавить проверку на дублирующийся телефон
router.post("/", clientValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { password, phone, ...rest } = req.body;
    const existing = await Client.findOne({ phone });
    if (existing) {
      return res
        .status(400)
        .json({ message: "Bu telefon raqam bilan mijoz allaqachon mavjud" });
    }
    if (!password) {
      return res.status(400).json({ message: "Parol majburiy" });
    }
    const hashedPassword = await bcrypt.hash(password, 10); // Обработка автомобилей
    const cars = req.body.cars || [];
    const plateNumbers = new Set();
    for (const car of cars) {
      const normalizedPlateNumber = car.plateNumber.toUpperCase().trim();
      if (plateNumbers.has(normalizedPlateNumber)) {
        return res.status(400).json({
          message: `Avtomobil raqami takrorlanmoqda: ${normalizedPlateNumber}`,
        });
      }
      plateNumbers.add(normalizedPlateNumber);
      car.plateNumber = normalizedPlateNumber;
    }

    const client = new Client({
      ...rest,
      phone,
      password: hashedPassword,
      cars,
      debt: req.body.debt || 0,
      partialPayments: req.body.partialPayments || [],
    });

    await client.save();
    res.status(201).json(client);
  } catch (error) {
    res.status(500).json({ message: "Serverda xatolik" });
  }
});

// Получение списка клиентов
router.get("/", async (req, res) => {
  try {
    const { search } = req.query;
    let query = { isDeleted: false }; // Добавляем условие для исключения удаленных клиентов
    if (req.query.isDeleted === "true") {
      query.isDeleted = true; // Если isDeleted=true, то возвращаем удаленных клиентов
    } else {
      query.isDeleted = false; // По умолчанию исключаем удаленных клиентов
    }
    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    const clients = await Client.find(query)
    .sort({ createdAt: -1 });
    res.json(clients);
  } catch (error) {
    res.status(500).json({ message: "Serverda xatolik" });
  }
});

// Получение клиента по ID
router.get("/:id", async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) {
      return res.status(404).json({ message: "Mijoz topilmadi" });
    }

    if (client.isDeleted) {
      return res.status(400).json({ message: "Mijoz allaqachon o‘chirilgan" });
    }

    res.json(client);
  } catch (error) {
    res.status(500).json({ message: "Serverda xatolik" });
  }
});
// Обновление клиента
router.patch("/:id", authMiddleware, clientValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const client = await Client.findById(req.params.id);
    if (!client) {
      return res.status(404).json({ message: "Клиент не найден" });
    }

    if (client.isDeleted) {
      return res.status(400).json({ message: "Mijoz allaqachon o‘chirilgan" });
    }

    if (req.body.password) {
      req.body.password = await bcrypt.hash(req.body.password, 10);
    } else {
      delete req.body.password;
    }

    if (req.body.cars) {
      const plateNumbers = new Set();
      for (const car of req.body.cars) {
        const normalizedPlate = car.plateNumber.toUpperCase().trim();
        if (plateNumbers.has(normalizedPlate)) {
          return res.status(400).json({
            message: `Avtomobil raqami takrorlanmoqda: ${normalizedPlate}`,
          });
        }
        plateNumbers.add(normalizedPlate);
        car.plateNumber = normalizedPlate;

        if (typeof car.model === "object" && car.model !== null) {
          car.model = car.model._id;
        }
      }
    }

    const allowedFields = [
      "fullName",
      "phone",
      "password",
      "birthday",
      "notes",
      "cars",
      "debt",
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        client[field] = req.body[field];
      }
    });

    await client.save();
    res.json(client);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Serverda xatolik" });
  }
});

// Удаление клиента
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) {
      return res.status(404).json({ message: "Mijoz topilmadi" });
    }
    if (client.isDeleted) {
      return res.status(400).json({ message: "Mijoz allaqachon o‘chirilgan" });
    }
    client.phone = client._id; // Ustidan telefon raqamini o‘chirib tashlash
    client.isDeleted = true;
    client.deletedAt = new Date();
    await client.save();
    res.json({ message: "Mijoz muvaffaqiyatli o‘chirildi" });
  } catch (error) {
    res.status(500).json({ message: "Serverda xatolik" });
  }
});

module.exports = router;
