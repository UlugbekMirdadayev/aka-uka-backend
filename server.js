require("dotenv").config();
const express = require("express");
const connectDB = require("./config/db");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const app = express();
const server = http.createServer(app);

// Socket.IO setup with CORS
const io = new Server(server, {
  cors: {
    origin: "*", // В продакшене укажите конкретные домены
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  },
});

// Make io accessible to routes
app.set("io", io);
const { swaggerUi, swaggerSpec } = require("./swagger");
const adminRoutes = require("./routes/adminRoutes");
const clientRoutes = require("./routes/clientRoutes");
const orderRoutes = require("./routes/orderRoutes");
const producRoutes = require("./routes/productRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const transactionRoutes = require("./routes/transactionRoutes");
const debtorRoutes = require("./routes/debtorRoutes");
const smsRoutes = require("./routes/smsRoutes");
const smsNotificationService = require("./services/smsNotificationService");

// Middleware
app.use(express.json({ limit: "25mb" })); // Увеличиваем лимит для больших файлов
app.use(cors());

// Connect to MongoDB
connectDB();

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use("/api/admin", adminRoutes);
app.use("/api/clients", clientRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/products", producRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/debtors", debtorRoutes);
app.use("/api/sms", smsRoutes);

// Socket.IO connection handling
io.on("connection", (socket) => {
  console.log("Клиент подключился:", socket.id);

  socket.on("join_room", (room) => {
    socket.join(room);
    console.log(`Клиент ${socket.id} присоединился к комнате: ${room}`);
  });

  socket.on("disconnect", () => {
    console.log("Клиент отключился:", socket.id);
  });
});

// Handle 404 errors
app.use((req, res) => {
  req.path === "/privacy"
    ? res.sendFile(__dirname + "/public/privacy.html")
    : req.path === "/terms"
    ? res.sendFile(__dirname + "/public/terms.html")
    : req.path === "/help"
    ? res.sendFile(__dirname + "/public/help.html")
    : res.status(404).sendFile(__dirname + "/public/404.html");
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: "Internal Server Error",
    error: process.env.NODE_ENV === "development" ? err.message : undefined,
    timestamp: new Date().toISOString().slice(0, 19).replace("T", " "),
  });
});

// Server startup
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(
    `Server ${PORT}-portda ishlayapti\nDocumentatsiya: http://localhost:${PORT}/api-docs`
  );
  console.log(
    `Server started at: ${new Date(
      new Date().setHours(new Date().getHours() + 5)
    )
      .toISOString()
      .slice(0, 19)
      .replace("T", " ")}`
  );

  // SMS notification service'ini ishga tushirish
  try {
    smsNotificationService.startScheduledTasks();
    console.log("SMS notification service avtomatik ishga tushirildi");
  } catch (error) {
    console.error(
      "SMS notification service ishga tushirishda xatolik:",
      error.message
    );
  }
});
