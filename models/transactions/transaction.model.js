const mongoose = require("mongoose");
const { withBaseFields } = require("../base.model");

const transactionSchema = withBaseFields({
  type: {
    type: String,
    enum: [
      "cash-in",
      "cash-out",
      "order",
      "debt-payment",
      "debt-created",
    ],
    required: true,
  },
  amount: {
    type: Number,
    required: true,
    min: 0,
    default: 0,
  },
  paymentType: {
    type: String,
    enum: ["cash", "card", "debt"],
    required: true,
  },
  description: {
    type: String,
    trim: true,
    default: "",
  },
  // Qaysi modelga tegishli (order, debtor)
  relatedModel: {
    type: String,
    enum: ["Order", "Debtor"],
    default: null,
  },
  relatedId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null,
  },
  // Mijoz ma'lumoti
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Client",
    default: null,
  },
  // Removed branch reference
  // Kim yaratgan
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Admin",
    default: null,
  },
});

module.exports = mongoose.model("Transaction", transactionSchema);
