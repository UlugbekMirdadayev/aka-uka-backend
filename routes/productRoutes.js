const express = require("express");
const router = express.Router();
const Product = require("../models/products/product.model");
const authMiddleware = require("../middleware/authMiddleware");
const { body, validationResult } = require("express-validator");

/** Product validation rules for form-data (more flexible) */
const productFormValidation = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Product name is required")
    .not()
    .equals("string")
    .withMessage("Product name cannot be 'string'"),
  body("costPrice").custom((value) => {
    const num = Number(value);
    if (isNaN(num)) throw new Error("Cost price must be a number");
    if (num < 0) throw new Error("Cost price cannot be negative");
    return true;
  }),
  body("salePrice").custom((value) => {
    const num = Number(value);
    if (isNaN(num)) throw new Error("Sale price must be a number");
    if (num < 0) throw new Error("Sale price cannot be negative");
    return true;
  }),
  body("quantity").custom((value) => {
    const num = Number(value);
    if (isNaN(num)) throw new Error("Quantity must be a number");
    if (num < 0) throw new Error("Quantity cannot be negative");
    return true;
  }),
  body("minQuantity").custom((value) => {
    const num = Number(value);
    if (isNaN(num)) throw new Error("Minimal quantity must be a number");
    if (num < 0) throw new Error("Minimal quantity cannot be negative");
    return true;
  }),
  body("isAvailable")
    .optional()
    .isIn(["true", "false", true, false])
    .withMessage("isAvailable must be a boolean or boolean string"),
  // Игнорируем старые поля, которые могут приходить с фронтенда
];

/** Create product */
router.post(
  "/",
  authMiddleware,
  (req, res, next) => next(),
  productFormValidation,
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      // Фильтруем и преобразуем данные из req.body
      const allowedFields = {
        name: req.body.name?.trim(),
        costPrice: Number(req.body.costPrice),
        salePrice: Number(req.body.salePrice),
        quantity: Number(req.body.quantity),
        minQuantity: Number(req.body.minQuantity),
        unit: req.body.unit?.trim(),
        description:
          req.body.description === "string" ? "" : req.body.description || "",
        isAvailable:
          req.body.isAvailable === "false"
            ? false
            : req.body.isAvailable !== "false" &&
              req.body.isAvailable !== false,
      };

      console.log("Processed fields:", allowedFields);

      const product = new Product(allowedFields);
      await product.save();
      const populatedProduct = await Product.findById(product._id);

      res.status(201).json(populatedProduct);
    } catch (error) {
      console.error("Error creating product:", error);
      res.status(500).json({
        message: error.message,
        error: process.env.NODE_ENV === "development" ? error.stack : undefined,
      });
    }
  }
);

/** Get all products */
router.get("/", async (req, res) => {
  try {
    const {
      name,
      minCostPrice,
      maxCostPrice,
      minSalePrice,
      maxSalePrice,
      search,
      isAvailable,
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    // Преобразуем параметры пагинации в числа
    const pageNumber = Math.max(1, parseInt(page));
    const limitNumber = Math.max(
      1,
      Math.min(
        await Product.countDocuments({ isDeleted: false }),
        parseInt(limit)
      )
    ); // Максимум 100 элементов на страницу
    const skip = (pageNumber - 1) * limitNumber;

    // Валидация sortBy параметра
    const allowedSortFields = [
      "name",
      "costPrice",
      "salePrice",
      "quantity",
      "createdAt",
      "updatedAt",
    ];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : "createdAt";
    const sortDirection = sortOrder.toLowerCase() === "asc" ? 1 : -1;

    const query = { isDeleted: false };
    if (name) query.name = { $regex: name, $options: "i" };
    if (minCostPrice || maxCostPrice) {
      query.costPrice = {};
      if (minCostPrice) query.costPrice.$gte = Number(minCostPrice);
      if (maxCostPrice) query.costPrice.$lte = Number(maxCostPrice);
    }
    if (minSalePrice || maxSalePrice) {
      query.salePrice = {};
      if (minSalePrice) query.salePrice.$gte = Number(minSalePrice);
      if (maxSalePrice) query.salePrice.$lte = Number(maxSalePrice);
    }
    if (isAvailable !== undefined) {
      query.isAvailable = isAvailable === "true";
    }
    if (search) query.name = { $regex: search, $options: "i" };

    // Получаем общее количество документов для пагинации
    const totalCount = await Product.countDocuments(query);
    const totalPages = Math.ceil(totalCount / limitNumber);

    const products = await Product.find(query)
      .sort({ [sortField]: sortDirection })
      .skip(skip)
      .limit(limitNumber);

    // Возвращаем данные с метаинформацией о пагинации
    res.json({
      data: products,
      pagination: {
        currentPage: pageNumber,
        totalPages,
        totalCount,
        limit: limitNumber,
        hasNextPage: pageNumber < totalPages,
        hasPrevPage: pageNumber > 1,
        nextPage: pageNumber < totalPages ? pageNumber + 1 : null,
        prevPage: pageNumber > 1 ? pageNumber - 1 : null,
      },
      sorting: {
        sortBy: sortField,
        sortOrder: sortDirection === 1 ? "asc" : "desc",
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/** Get product by ID */
router.get("/:id", async (req, res) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      isDeleted: false,
    });
    if (!product) return res.status(404).json({ message: "Product not found" });

    res.json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/** Update product by ID */
router.patch(
  "/:id",
  authMiddleware,
  (req, res, next) => {
    console.log("Received product update data:", req.body);
    next();
  },
  productFormValidation,
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const product = await Product.findOne({
        _id: req.params.id,
        isDeleted: false,
      });
      if (!product)
        return res.status(404).json({ message: "Product not found" });

      // Фильтруем только разрешенные поля для обновления
      const allowedFields = {};
      if (req.body.name !== undefined) allowedFields.name = req.body.name;
      if (req.body.costPrice !== undefined)
        allowedFields.costPrice = req.body.costPrice;
      if (req.body.salePrice !== undefined)
        allowedFields.salePrice = req.body.salePrice;
      if (req.body.quantity !== undefined)
        allowedFields.quantity = req.body.quantity;
      if (req.body.minQuantity !== undefined)
        allowedFields.minQuantity = req.body.minQuantity;
      if (req.body.unit !== undefined) allowedFields.unit = req.body.unit;
      if (req.body.description !== undefined)
        allowedFields.description = req.body.description;
      if (req.body.isAvailable !== undefined) {
        allowedFields.isAvailable =
          req.body.isAvailable === "false"
            ? false
            : Boolean(req.body.isAvailable);
      }

      // Обновляем данные продукта
      Object.assign(product, allowedFields);
      await product.save();

      const populatedProduct = await Product.findById(product._id);

      res.json(populatedProduct);
    } catch (error) {
      console.error("Error updating product:", error);
      res.status(500).json({
        message: error.message,
        error: process.env.NODE_ENV === "development" ? error.stack : undefined,
      });
    }
  }
);

/** Soft delete product by ID */
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      isDeleted: false,
    });
    if (!product) return res.status(404).json({ message: "Product not found" });
    product.isDeleted = true;
    product.deletedAt = new Date();
    await product.save();
    res.json({ message: "Product soft deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/** Quick search products by name */
router.get("/search/:query", async (req, res) => {
  try {
    const { query } = req.params;
    const {
      isAvailable,
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    // Преобразуем параметры пагинации в числа
    const pageNumber = Math.max(1, parseInt(page));
    const limitNumber = Math.max(1, Math.min(50, parseInt(limit))); // Максимум 50 элементов для поиска
    const skip = (pageNumber - 1) * limitNumber;

    // Валидация sortBy параметра
    const allowedSortFields = [
      "name",
      "costPrice",
      "salePrice",
      "quantity",
      "createdAt",
      "updatedAt",
    ];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : "createdAt";
    const sortDirection = sortOrder.toLowerCase() === "asc" ? 1 : -1;

    const searchQuery = {
      name: { $regex: query, $options: "i" },
      isDeleted: false,
    };

    if (isAvailable !== undefined) {
      searchQuery.isAvailable = isAvailable === "true";
    }

    // Получаем общее количество документов для пагинации
    const totalCount = await Product.countDocuments(searchQuery);
    const totalPages = Math.ceil(totalCount / limitNumber);

    const products = await Product.find(searchQuery)
      .sort({ [sortField]: sortDirection })
      .skip(skip)
      .limit(limitNumber);

    res.json({
      data: products,
      pagination: {
        currentPage: pageNumber,
        totalPages,
        totalCount,
        limit: limitNumber,
        hasNextPage: pageNumber < totalPages,
        hasPrevPage: pageNumber > 1,
        nextPage: pageNumber < totalPages ? pageNumber + 1 : null,
        prevPage: pageNumber > 1 ? pageNumber - 1 : null,
      },
      sorting: {
        sortBy: sortField,
        sortOrder: sortDirection === 1 ? "asc" : "desc",
      },
      searchQuery: query,
    });
  } catch (error) {
    console.error("Error searching products:", error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;

/**
 * @swagger
 * components:
 *   schemas:
 *     Product:
 *       type: object
 *       required:
 *         - name
 *         - costPrice
 *         - salePrice
 *         - quantity
 *         - minQuantity
 *         - unit
 *       properties:
 *         _id:
 *           type: string
 *           description: Unique identifier for the product
 *         name:
 *           type: string
 *           description: Product name
 *         costPrice:
 *           type: number
 *           description: Cost price of the product
 *         salePrice:
 *           type: number
 *           description: Sale price of the product
 *         quantity:
 *           type: number
 *           minimum: 0
 *           description: Current quantity in stock
 *         minQuantity:
 *           type: number
 *           minimum: 0
 *           description: Minimum quantity threshold
 *         unit:
 *           type: string
 *           description: Unit of measurement
 *         description:
 *           type: string
 *           description: Product description
 *         isAvailable:
 *           type: boolean
 *           default: true
 *           description: Whether the product is available for sale
 *         isDeleted:
 *           type: boolean
 *           default: false
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *
 *     ProductInput:
 *       type: object
 *       required:
 *         - name
 *         - costPrice
 *         - salePrice
 *         - quantity
 *         - minQuantity
 *         - unit
 *       properties:
 *         name:
 *           type: string
 *           example: "Motor Oil 5W-30"
 *           description: Product name
 *         costPrice:
 *           type: number
 *           example: 50000
 *           description: Cost price of the product
 *         salePrice:
 *           type: number
 *           example: 75000
 *           description: Sale price of the product
 *         quantity:
 *           type: number
 *           minimum: 0
 *           example: 100.5
 *           description: Current quantity in stock
 *         minQuantity:
 *           type: number
 *           minimum: 0
 *           example: 10.5
 *           description: Minimum quantity threshold
 *         unit:
 *           type: string
 *           example: "литр"
 *           description: Unit of measurement
 *         description:
 *           type: string
 *           example: "High quality motor oil for modern engines"
 *           description: Product description
 *         isAvailable:
 *           type: boolean
 *           example: true
 *           description: Whether the product is available for sale
 *
 *     ProductFormUpdateInput:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *           description: Product name
 *         costPrice:
 *           type: number
 *           description: Cost price of the product
 *         salePrice:
 *           type: number
 *           description: Sale price of the product
 *         quantity:
 *           type: number
 *           minimum: 0
 *           description: Current quantity in stock
 *         minQuantity:
 *           type: number
 *           minimum: 0
 *           description: Minimum quantity threshold
 *         unit:
 *           type: string
 *           description: Unit of measurement
 *         description:
 *           type: string
 *           description: Product description
 *         isAvailable:
 *           type: boolean
 *           description: Whether the product is available for sale
 *
 *     ProductFormInput:
 *       type: object
 *       required:
 *         - name
 *         - costPrice
 *         - salePrice
 *         - quantity
 *         - minQuantity
 *         - unit
 *       properties:
 *         name:
 *           type: string
 *           description: Product name
 *         costPrice:
 *           type: number
 *           description: Cost price of the product
 *         salePrice:
 *           type: number
 *           description: Sale price of the product
 *         quantity:
 *           type: number
 *           minimum: 0
 *           description: Current quantity in stock
 *         minQuantity:
 *           type: number
 *           minimum: 0
 *           description: Minimum quantity threshold
 *         unit:
 *           type: string
 *           description: Unit of measurement
 *         description:
 *           type: string
 *           description: Product description
 *         isAvailable:
 *           type: boolean
 *           description: Whether the product is available for sale
 *
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */

/**
 * @swagger
 * /api/products:
 *   post:
 *     summary: Create a new product with multipart form data or JSON
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/ProductFormInput'
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ProductInput'
 *           example:
 *             name: "Motor Oil 5W-30"
 *             costPrice: 50000
 *             salePrice: 75000
 *             quantity: 100.5
 *             minQuantity: 10.5
 *             unit: "литр"
 *             description: "High quality motor oil"
 *             isAvailable: true
 *     responses:
 *       201:
 *         description: Product created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Product'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       msg:
 *                         type: string
 *                       param:
 *                         type: string
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 *
 *   get:
 *     summary: Get all products
 *     tags: [Products]
 *     parameters:
 *       - in: query
 *         name: name
 *         schema:
 *           type: string
 *         description: Filter by product name (case insensitive)
 *       - in: query
 *         name: minCostPrice
 *         schema:
 *           type: number
 *         description: Minimum cost price filter
 *       - in: query
 *         name: maxCostPrice
 *         schema:
 *           type: number
 *         description: Maximum cost price filter
 *       - in: query
 *         name: minSalePrice
 *         schema:
 *           type: number
 *         description: Minimum sale price filter
 *       - in: query
 *         name: maxSalePrice
 *         schema:
 *           type: number
 *         description: Maximum sale price filter
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by product name
 *       - in: query
 *         name: isAvailable
 *         schema:
 *           type: boolean
 *         description: Filter by product availability
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Number of items per page (max 100)
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [name, costPrice, salePrice, quantity, createdAt, updatedAt]
 *           default: createdAt
 *         description: Field to sort by
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Paginated list of products
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Product'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     currentPage:
 *                       type: integer
 *                       example: 1
 *                     totalPages:
 *                       type: integer
 *                       example: 5
 *                     totalCount:
 *                       type: integer
 *                       example: 50
 *                     limit:
 *                       type: integer
 *                       example: 10
 *                     hasNextPage:
 *                       type: boolean
 *                       example: true
 *                     hasPrevPage:
 *                       type: boolean
 *                       example: false
 *                     nextPage:
 *                       type: integer
 *                       nullable: true
 *                       example: 2
 *                     prevPage:
 *                       type: integer
 *                       nullable: true
 *                       example: null
 *                 sorting:
 *                   type: object
 *                   properties:
 *                     sortBy:
 *                       type: string
 *                       example: "createdAt"
 *                     sortOrder:
 *                       type: string
 *                       example: "desc"
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /api/products/{id}:
 *   get:
 *     summary: Get product by ID
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Product ID
 *     responses:
 *       200:
 *         description: Product details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Product'
 *       404:
 *         description: Product not found
 *       500:
 *         description: Internal server error
 *
 *   patch:
 *     summary: Update product by ID
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Product ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/ProductFormUpdateInput'
 *           example:
 *             name: "Updated Motor Oil 5W-30"
 *             costPrice: 55000
 *             salePrice: 80000
 *             quantity: 90
 *             unit: "литр"
 *             description: "Updated description"
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ProductInput'

 *     responses:
 *       200:
 *         description: Product updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Product'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Product not found
 *       500:
 *         description: Internal server error
 *
 *   delete:
 *     summary: Soft delete product by ID
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Product ID
 *     responses:
 *       200:
 *         description: Product deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Product soft deleted successfully"
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Product not found
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /api/products/search/{query}:
 *   get:
 *     summary: Quick search products by name
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: query
 *         required: true
 *         schema:
 *           type: string
 *         description: Search query for product name
 *       - in: query
 *         name: isAvailable
 *         schema:
 *           type: boolean
 *         description: Filter by product availability
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 10
 *         description: Number of items per page (max 50 for search)
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [name, costPrice, salePrice, quantity, createdAt, updatedAt]
 *           default: createdAt
 *         description: Field to sort by
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Paginated search results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Product'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     currentPage:
 *                       type: integer
 *                       example: 1
 *                     totalPages:
 *                       type: integer
 *                       example: 3
 *                     totalCount:
 *                       type: integer
 *                       example: 25
 *                     limit:
 *                       type: integer
 *                       example: 10
 *                     hasNextPage:
 *                       type: boolean
 *                       example: true
 *                     hasPrevPage:
 *                       type: boolean
 *                       example: false
 *                     nextPage:
 *                       type: integer
 *                       nullable: true
 *                       example: 2
 *                     prevPage:
 *                       type: integer
 *                       nullable: true
 *                       example: null
 *                 sorting:
 *                   type: object
 *                   properties:
 *                     sortBy:
 *                       type: string
 *                       example: "createdAt"
 *                     sortOrder:
 *                       type: string
 *                       example: "desc"
 *                 searchQuery:
 *                   type: string
 *                   example: "motor oil"
 *                   description: The search query that was used
 *       500:
 *         description: Internal server error
 */
