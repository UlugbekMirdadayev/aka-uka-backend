const cron = require("node-cron");
const Debtor = require("../models/debtors/debtor.model");
const Client = require("../models/clients/client.model");
const SMS = require("../models/sms/sms.model");
const { sendSMS } = require("../config/eskizuz");

class SMSNotificationService {
  constructor() {
    this.isRunning = false;
    this.scheduledTasks = new Map();
  }

  // SMS shablonlari (eskiz.uz dan tasdiqdan o'tganda o'zgartiriladi)
  getSMSTemplate(type, clientName, amount, currency, dueDate) {
    const templates = {
      // 3 kun oldin yuborilgan SMS shablon
      "3_kun_oldin": `Hurmatli ${clientName}!
Sizning ${amount} ${currency} qarzingizni qaytarish muddati 3 kundan keyin (${dueDate}) tugaydi.
Vaqtida to'lov qiling. Ma'lumot: +998996572600`,

      // Qarz qaytarish kuni yuborilgan SMS shablon
      "bugun": `Hurmatli ${clientName}!
Bugun sizning ${amount} ${currency} qarzingizni qaytarish muddati tugaydi.
Zudlik bilan to'lov qiling. Ma'lumot: +998996572600`
    };

    return templates[type] || templates["bugun"];
  }

  // Hozirgi vaqtdan 3 kun keyingi sanani olish
  getDateAfterDays(days) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  // Sanani formatlash (DD.MM.YYYY)
  formatDate(date) {
    return date.toLocaleDateString("uz-UZ", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  }

  // 3 kun oldin SMS yuborish
  async sendReminder3DaysBefore() {
    try {
      console.log("3 kun oldin eslatma SMS'lari yuborilmoqda...");

      const threeDaysLater = this.getDateAfterDays(3);
      
      // 3 kun keyingi to'lov muddati bo'lgan qarzdorlarni topish
      const debtors = await Debtor.find({
        status: { $ne: "paid" },
        "nextPayment.dueDate": {
          $gte: threeDaysLater,
          $lt: new Date(threeDaysLater.getTime() + 24 * 60 * 60 * 1000)
        }
      }).populate("client");

      console.log(`3 kun oldin eslatma uchun ${debtors.length} qarzdor topildi`);

      for (const debtor of debtors) {
        try {
          // Avval ushbu mijoz uchun 3 kun oldin SMS yuborilganligini tekshirish
          const existingSMS = await SMS.findOne({
            clientId: debtor.client._id,
            type: "debt_reminder_3_days",
            createdAt: {
              $gte: new Date(new Date().setHours(0, 0, 0, 0)),
              $lt: new Date(new Date().setHours(23, 59, 59, 999))
            }
          });

          if (existingSMS) {
            console.log(`Mijoz ${debtor.client.name} uchun bugun allaqachon 3 kun oldin SMS yuborilgan`);
            continue;
          }

          // Qarz miqdorini hisoblash
          const totalDebt = debtor.currentDebt;
          let amount, currency;
          
          amount = totalDebt.toLocaleString();
          currency = "UZS";

          const dueDate = this.formatDate(debtor.nextPayment.dueDate);
          const message = this.getSMSTemplate("3_kun_oldin", debtor.client.name, amount, currency, dueDate);

          // SMS yuborish
          const result = await sendSMS(debtor.client.phone, message);

          // SMS bazaga saqlash
          const smsRecord = new SMS({
            clientId: debtor.client._id,
            phone: debtor.client.phone,
            message: message,
            messageId: result.message_id,
            status: result.status,
            cost: result.cost || 0,
            parts: result.parts || 1,
            type: "debt_reminder_3_days",
            sentAt: new Date()
          });

          await smsRecord.save();
          console.log(`3 kun oldin eslatma SMS ${debtor.client.name} ga yuborildi`);

        } catch (error) {
          console.error(`Mijoz ${debtor.client.name} ga SMS yuborishda xatolik:`, error.message);
        }
      }

    } catch (error) {
      console.error("3 kun oldin eslatma SMS'larini yuborishda xatolik:", error.message);
    }
  }

  // Qarz qaytarish kuni SMS yuborish
  async sendReminderOnDueDate() {
    try {
      console.log("Qarz qaytarish kuni SMS'lar yuborilmoqda...");

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Bugungi kunda to'lov muddati bo'lgan qarzdorlarni topish
      const debtors = await Debtor.find({
        status: { $ne: "paid" },
        "nextPayment.dueDate": {
          $gte: today,
          $lt: tomorrow
        }
      }).populate("client");

      console.log(`Bugun to'lov kuni uchun ${debtors.length} qarzdor topildi`);

      for (const debtor of debtors) {
        try {
          // Avval ushbu mijoz uchun bugun SMS yuborilganligini tekshirish
          const existingSMS = await SMS.findOne({
            clientId: debtor.client._id,
            type: "debt_reminder_due_date",
            createdAt: {
              $gte: today,
              $lt: tomorrow
            }
          });

          if (existingSMS) {
            console.log(`Mijoz ${debtor.client.name} uchun bugun allaqachon eslatma SMS yuborilgan`);
            continue;
          }

          // Qarz miqdorini hisoblash
          let amount, currency;
          
          amount = debtor.currentDebt.toLocaleString();
          currency = "UZS";

          const message = this.getSMSTemplate("bugun", debtor.client.name, amount, currency, "bugun");

          // SMS yuborish
          const result = await sendSMS(debtor.client.phone, message);

          // SMS bazaga saqlash
          const smsRecord = new SMS({
            clientId: debtor.client._id,
            phone: debtor.client.phone,
            message: message,
            messageId: result.message_id,
            status: result.status,
            cost: result.cost || 0,
            parts: result.parts || 1,
            type: "debt_reminder_due_date",
            sentAt: new Date()
          });

          await smsRecord.save();
          console.log(`Eslatma SMS ${debtor.client.name} ga yuborildi (to'lov kuni)`);

          // Qarzdor statusini overdue ga o'zgartirish
          debtor.status = "overdue";
          await debtor.save();

        } catch (error) {
          console.error(`Mijoz ${debtor.client.name} ga SMS yuborishda xatolik:`, error.message);
        }
      }

    } catch (error) {
      console.error("Eslatma SMS'larini yuborishda xatolik:", error.message);
    }
  }

  // Cron job'larni ishga tushirish
  startScheduledTasks() {
    if (this.isRunning) {
      console.log("SMS notification service allaqachon ishlamoqda");
      return;
    }

    // Har kuni soat 09:00 da 3 kun oldin eslatma SMS'larini yuborish
    const task1 = cron.schedule('0 9 * * *', async () => {
      await this.sendReminder3DaysBefore();
    }, {
      scheduled: false,
      timezone: "Asia/Tashkent"
    });

    // Har kuni soat 10:00 da qarz qaytarish kuni SMS'larini yuborish
    const task2 = cron.schedule('0 10 * * *', async () => {
      await this.sendReminderOnDueDate();
    }, {
      scheduled: false,
      timezone: "Asia/Tashkent"
    });

    // Task'larni ishga tushirish
    task1.start();
    task2.start();

    this.scheduledTasks.set("reminder_3_days", task1);
    this.scheduledTasks.set("reminder_due_date", task2);

    this.isRunning = true;
    console.log("SMS notification service ishga tushirildi");
    console.log("- 3 kun oldin eslatma: har kuni soat 09:00");
    console.log("- To'lov kuni eslatma: har kuni soat 10:00");
  }

  // Cron job'larni to'xtatish
  stopScheduledTasks() {
    if (!this.isRunning) {
      console.log("SMS notification service ishlamayapti");
      return;
    }

    this.scheduledTasks.forEach((task, name) => {
      task.destroy();
      console.log(`${name} task to'xtatildi`);
    });

    this.scheduledTasks.clear();
    this.isRunning = false;
    console.log("SMS notification service to'xtatildi");
  }

  // Joriy holatni ko'rish
  getStatus() {
    return {
      isRunning: this.isRunning,
      activeTasks: Array.from(this.scheduledTasks.keys()),
      nextExecutions: {
        reminder_3_days: "Har kuni soat 09:00",
        reminder_due_date: "Har kuni soat 10:00"
      }
    };
  }

  // Manual test uchun
  async testReminders() {
    console.log("SMS eslatmalar test qilinmoqda...");
    await Promise.all([
      this.sendReminder3DaysBefore(),
      this.sendReminderOnDueDate()
    ]);
    console.log("Test yakunlandi");
  }
}

module.exports = new SMSNotificationService();
