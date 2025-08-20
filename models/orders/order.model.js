const { withBaseFields } = require("../base.model");
const mongoose = require("mongoose");

const orderProductSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    default: 1,
  },
  price: {
    type: Number,
    required: true,
  },
  costPrice: {
    type: Number,
    required: true,
    default: 0,
  },
  profit: {
    type: Number,
    default: 0,
  },
});

const orderSchema = withBaseFields({
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Client",
  },
  products: {
    type: [orderProductSchema],
    required: true,
  },
  totalAmount: {
    type: Number, 
    required: true, 
    default: 0
  },
  paidAmount: {
    type: Number, 
    required: true, 
    default: 0
  },
  debtAmount: {
    type: Number, 
    required: true, 
    default: 0
  },
  profitAmount: {
    type: Number, 
    required: true, 
    default: 0
  },
  // Removed branch reference
  notes: {
    type: String,
    default: "",
  },
  paymentType: {
    type: String,
    enum: ["cash", "card", "debt"],
    default: "cash",
  },
  date_returned: {
    type: Date,
    default: null,
  },
  status: {
    type: String,
    enum: ["pending", "completed", "cancelled"],
    default: "pending",
    required: true,
  },
  car: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
});

module.exports = mongoose.model("Order", orderSchema);
