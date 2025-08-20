const mongoose = require("mongoose");

const baseFields = {
  isDeleted: {
    type: Boolean,
    default: false,
  },
  deletedAt: {
    type: Date,
    default: null,
  },
};

function withBaseFields(schemaDefinition) {
  return new mongoose.Schema(
    {
      ...schemaDefinition,
      ...baseFields,
    },
    { timestamps: true, versionKey: false }
  );
}

module.exports = { withBaseFields };