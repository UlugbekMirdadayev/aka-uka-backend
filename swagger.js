const swaggerJSDoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

// Swagger sozlamalari
const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "AKA-UKA Go'sht Marzkazi API",
      version: "1.0.0",
      description: "AKA-UKA Go'sht Marzkazi uchun Swagger dokumentatsiyasi",
    },
    servers: [
      {
        url: "http://localhost:8080",
        description: "Local server",
      },
      {
        url: "https://aka-uka.up.railway.app",
        description: "Production server",
      },
    ],
  },
  apis: ["./routes/*.js"], // Swagger yozuvlar bo‘ladigan fayllar yo‘li
};

const swaggerSpec = swaggerJSDoc(options);

module.exports = { swaggerUi, swaggerSpec };
