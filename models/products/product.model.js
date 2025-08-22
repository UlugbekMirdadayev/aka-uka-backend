const { withBaseFields } = require("../base.model");
const mongoose = require("mongoose");

const productSchema = withBaseFields({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  costPrice: {
    type: Number,
    required: true,
    default: 0,
  },
  salePrice: {
    type: Number,
    required: true,
    default: 0,
  },
  quantity: {
    type: Number,
    required: true,
    default: 0,
  },
  minQuantity: {
    type: Number,
    required: true,
    default: 0,
  },
  unit: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
    default: "",
  },
  isAvailable: {
    type: Boolean,
    required: true,
    default: true,
  },
});

module.exports = mongoose.model("Product", productSchema);
