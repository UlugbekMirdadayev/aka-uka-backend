const mongoose = require("mongoose");

const smsSchema = new mongoose.Schema(
  {
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      default: null,
    },
    phone: {
      type: String,
      required: true,
      match: /^998\d{9}$/,
    },
    message: {
      type: String,
      required: true,
      maxlength: 918, // Увеличили лимит согласно API
    },
    status: {
      type: String,
      enum: [
        "pending",
        "sent",
        "delivered",
        "failed",
        "waiting",
        "NEW",
        "STORED",
        "ACCEPTED",
        "PARTDELIVERED",
        "DELIVERED",
        "REJECTED",
        "UNDELIV",
        "UNDELIVERABLE",
        "EXPIRED",
        "REJECTD",
        "DELETED",
        "UNKNOWN",
        "ENROUTE",
        "DELIVRD",
      ],
      default: "pending",
    },
    messageId: {
      // Eskiz message ID
      type: String,
      default: null,
    },
    eskizMessageId: {
      // Backward compatibility
      type: String,
      default: null,
    },
    response: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    sentAt: {
      type: Date,
      default: null,
    },
    deliveredAt: {
      type: Date,
      default: null,
    },
    failureReason: {
      type: String,
      default: null,
    },
    statusNote: {
      // Дополнительная информация о статусе
      type: String,
      default: null,
    },
    retryCount: {
      type: Number,
      default: 0,
      max: 3,
    },
    type: {
      type: String,
      enum: ["order", "notification", "verification", "marketing", "debt_reminder_3_days", "debt_reminder_due_date"],
      default: "notification",
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      default: null,
    },
    sentBy: {
      // Кто отправил SMS (admin)
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
    adminId: {
      // Backward compatibility
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
    cost: {
      type: Number,
      default: 0,
    },
    parts: {
      // Количество частей SMS
      type: Number,
      default: 1,
    },
    callbackUrl: {
      // URL для callback
      type: String,
      default: null,
    },
    callbackReceivedAt: {
      // Когда получен callback
      type: Date,
      default: null,
    },
    from: {
      // Отправитель (никнейм)
      type: String,
      default: "4546",
    },
  },
  {
    timestamps: true,
    collection: "sms",
  }
);

// Indekslar
smsSchema.index({ phone: 1 });
smsSchema.index({ status: 1 });
smsSchema.index({ type: 1 });
smsSchema.index({ createdAt: -1 });
smsSchema.index({ orderId: 1 });
smsSchema.index({ clientId: 1 });
smsSchema.index({ sentBy: 1 });
smsSchema.index({ messageId: 1 });
smsSchema.index({ eskizMessageId: 1 }); // Backward compatibility

// Virtual maydonlar
smsSchema.virtual("isDelivered").get(function () {
  return (
    this.status === "delivered" ||
    this.status === "DELIVERED" ||
    this.status === "DELIVRD"
  );
});

smsSchema.virtual("isFailed").get(function () {
  return (
    this.status === "failed" ||
    this.status === "REJECTED" ||
    this.status === "UNDELIV" ||
    this.status === "UNDELIVERABLE" ||
    this.status === "EXPIRED" ||
    this.status === "REJECTD" ||
    this.status === "DELETED"
  );
});

smsSchema.virtual("isPending").get(function () {
  return (
    this.status === "pending" ||
    this.status === "NEW" ||
    this.status === "waiting" ||
    this.status === "STORED"
  );
});

smsSchema.virtual("isInProgress").get(function () {
  return (
    this.status === "sent" ||
    this.status === "ACCEPTED" ||
    this.status === "ENROUTE" ||
    this.status === "UNKNOWN"
  );
});

smsSchema.virtual("duration").get(function () {
  if (this.sentAt && this.deliveredAt) {
    return this.deliveredAt - this.sentAt;
  }
  return null;
});

// Metodlar
smsSchema.methods.markAsSent = function (messageId, response) {
  this.status = "sent";
  this.messageId = messageId;
  this.eskizMessageId = messageId; // Backward compatibility
  this.response = response;
  this.sentAt = new Date();
  return this.save();
};

smsSchema.methods.markAsDelivered = function () {
  this.status = "DELIVERED";
  this.deliveredAt = new Date();
  return this.save();
};

smsSchema.methods.markAsFailed = function (reason) {
  this.status = "failed";
  this.failureReason = reason;
  this.retryCount += 1;
  return this.save();
};

smsSchema.methods.updateStatus = function (status, statusNote = null) {
  this.status = status;
  if (statusNote) {
    this.statusNote = statusNote;
  }

  // Автоматически устанавливаем deliveredAt для доставленных SMS
  if (this.isDelivered && !this.deliveredAt) {
    this.deliveredAt = new Date();
  }

  return this.save();
};

smsSchema.methods.canRetry = function () {
  return this.retryCount < 3 && this.isFailed;
};

// Statik metodlar
smsSchema.statics.findByPhone = function (phone) {
  return this.find({ phone });
};

smsSchema.statics.findByStatus = function (status) {
  return this.find({ status });
};

smsSchema.statics.findPendingSms = function () {
  return this.find({
    status: {
      $in: ["pending", "NEW", "waiting", "STORED"],
    },
  });
};

smsSchema.statics.findByMessageId = function (messageId) {
  return this.findOne({
    $or: [{ messageId: messageId }, { eskizMessageId: messageId }],
  });
};

smsSchema.statics.getStatistics = function (startDate, endDate) {
  const match = {};
  if (startDate && endDate) {
    match.createdAt = { $gte: startDate, $lte: endDate };
  }

  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        totalCost: { $sum: "$cost" },
        totalParts: { $sum: "$parts" },
      },
    },
  ]);
};

smsSchema.statics.getDetailedStatistics = function (startDate, endDate) {
  const match = {};
  if (startDate && endDate) {
    match.createdAt = { $gte: startDate, $lte: endDate };
  }

  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        pending: {
          $sum: {
            $cond: [
              { $in: ["$status", ["pending", "NEW", "waiting", "STORED"]] },
              1,
              0,
            ],
          },
        },
        sent: {
          $sum: {
            $cond: [
              { $in: ["$status", ["sent", "ACCEPTED", "ENROUTE"]] },
              1,
              0,
            ],
          },
        },
        delivered: {
          $sum: {
            $cond: [
              {
                $in: [
                  "$status",
                  ["delivered", "DELIVERED", "DELIVRD", "PARTDELIVERED"],
                ],
              },
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
                    "failed",
                    "REJECTED",
                    "UNDELIV",
                    "UNDELIVERABLE",
                    "EXPIRED",
                    "REJECTD",
                    "DELETED",
                  ],
                ],
              },
              1,
              0,
            ],
          },
        },
        totalCost: { $sum: "$cost" },
        totalParts: { $sum: "$parts" },
        averageParts: { $avg: "$parts" },
      },
    },
  ]);
};

smsSchema.statics.getDailyStats = function (days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return this.aggregate([
    { $match: { createdAt: { $gte: startDate } } },
    {
      $group: {
        _id: {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
          day: { $dayOfMonth: "$createdAt" },
        },
        total: { $sum: 1 },
        pending: {
          $sum: {
            $cond: [
              { $in: ["$status", ["pending", "NEW", "waiting", "STORED"]] },
              1,
              0,
            ],
          },
        },
        sent: {
          $sum: {
            $cond: [
              { $in: ["$status", ["sent", "ACCEPTED", "ENROUTE"]] },
              1,
              0,
            ],
          },
        },
        delivered: {
          $sum: {
            $cond: [
              {
                $in: [
                  "$status",
                  ["delivered", "DELIVERED", "DELIVRD", "PARTDELIVERED"],
                ],
              },
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
                    "failed",
                    "REJECTED",
                    "UNDELIV",
                    "UNDELIVERABLE",
                    "EXPIRED",
                    "REJECTD",
                    "DELETED",
                  ],
                ],
              },
              1,
              0,
            ],
          },
        },
        totalCost: { $sum: "$cost" },
        totalParts: { $sum: "$parts" },
      },
    },
    { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
  ]);
};

// Статистика по типам SMS
smsSchema.statics.getTypeStatistics = function (startDate, endDate) {
  const match = {};
  if (startDate && endDate) {
    match.createdAt = { $gte: startDate, $lte: endDate };
  }

  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$type",
        count: { $sum: 1 },
        totalCost: { $sum: "$cost" },
        delivered: {
          $sum: {
            $cond: [
              {
                $in: [
                  "$status",
                  ["delivered", "DELIVERED", "DELIVRD", "PARTDELIVERED"],
                ],
              },
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
                    "failed",
                    "REJECTED",
                    "UNDELIV",
                    "UNDELIVERABLE",
                    "EXPIRED",
                    "REJECTD",
                    "DELETED",
                  ],
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
    { $sort: { count: -1 } },
  ]);
};

// Pre-save hook
smsSchema.pre("save", function (next) {
  // Telefon raqamini formatlash
  if (this.phone && !this.phone.startsWith("998")) {
    this.phone = "998" + this.phone.replace(/\D/g, "");
  }
  next();
});

// Tostring metodi
smsSchema.methods.toString = function () {
  return `SMS to ${this.phone}: ${this.message} (${this.status})`;
};

module.exports = mongoose.model("SMS", smsSchema);
