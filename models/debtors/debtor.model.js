const { withBaseFields } = require("../base.model");
const mongoose = require("mongoose");

const debtorSchema = withBaseFields({
  // Kim qarzdor
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Client",
    required: true,
  },
  // Joriy qarz miqdori
  currentDebt: {
    type: Number, 
    required: true, 
    default: 0
  },
  // Birinchi marta qancha qarz bo'lgani va qachon
  initialDebt: {
    type: Number, 
    required: true, 
    default: 0
  },
  initialDebtDate: {
    type: Date,
    required: true,
    default: Date.now,
  },
  // Umumiy to'langan qarzlar
  totalPaid: {
    type: Number,
    required: true,
    default: 0
  },
  // Oxirgi to'lov ma'lumotlari
  lastPayment: {
    amount: {
      type: Number,
      default: 0
    },
    date: {
      type: Date,
      default: null,
    },
  },
  // Keyingi to'lov rejasi
  nextPayment: {
    amount: {
      type: Number,
      default: 0
    },
    dueDate: {
      type: Date,
      default: null,
    },
  },
  description: {
    type: String,
    trim: true,
    default: "",
  },
  status: {
    type: String,
    enum: ["pending", "partial", "paid", "overdue"],
    default: "pending",
    required: true,
  },
  // SMS eslatmalari uchun
  remindersSent: {
    threeDaysBefore: {
      sent: { type: Boolean, default: false },
      sentAt: { type: Date, default: null }
    },
    dueDate: {
      sent: { type: Boolean, default: false },
      sentAt: { type: Date, default: null }
    }
  }
});

// Qarzdorlik statusini avtomatik yangilash
debtorSchema.pre("save", function (next) {
  const oldStatus = this.status;

  if (this.currentDebt <= 0) {
    this.status = "paid";
  } else if (this.totalPaid > 0) {
    this.status = "partial";
  } else if (
    this.nextPayment.dueDate &&
    this.nextPayment.dueDate < new Date()
  ) {
    this.status = "overdue";
  } else {
    this.status = "pending";
  }
  
  // Agar status "paid" ga o'zgargan bo'lsa, SMS yuborish uchun event emit qilish
  if (oldStatus !== "paid" && this.status === "paid") {
    // Post middleware'da ishlatish uchun flag qo'yamiz
    this._statusChangedToPaid = true;
  }
  
  this.updatedAt = new Date();
  next();
});

// Status "paid" ga o'zgargan paytda SMS yuborish
debtorSchema.post("save", async function(doc) {
  if (doc._statusChangedToPaid) {
    try {
      const Client = mongoose.model("Client");
      const SMS = mongoose.model("SMS");
      const { sendSMS } = require("../../config/eskizuz");

      // Mijoz ma'lumotlarini olish
      const client = await Client.findById(doc.client);
      if (client && client.phone) {
        const message = `Hurmatli ${client.name}! Sizning qarzingiz to'liq to'landi. Bizga ishonch bildirganingiz uchun rahmat! Ma'lumot: +998996572600`;
        
        // SMS yuborish
        const result = await sendSMS(client.phone, message);
        
        // SMS bazaga saqlash
        const smsRecord = new SMS({
          clientId: client._id,
          phone: client.phone,
          message: message,
          messageId: result.message_id,
          status: result.status,
          cost: result.cost || 0,
          parts: result.parts || 1,
          type: "notification",
          sentAt: new Date()
        });
        
        await smsRecord.save();
        console.log(`Qarz to'liq to'langanligi haqida SMS ${client.name} ga yuborildi`);
      }
    } catch (error) {
      console.error("Qarz to'liq to'langanligi haqida SMS yuborishda xatolik:", error.message);
    }
  }
});

module.exports = mongoose.model("Debtor", debtorSchema);
