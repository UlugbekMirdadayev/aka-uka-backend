const jwt = require("jsonwebtoken");
const Client = require("../models/clients/client.model");
const Admin = require("../models/admin/admin.model");

const authMiddleware = async (req, res, next) => {
  const token = req.header("Authorization");

  if (!token) {
    return res.status(401).json({ message: "Token not found, please log in!" });
  }

  try {
    // Ensure the token has the "Bearer " prefix and strip it
    if (!token.startsWith("Bearer ")) {
      throw new Error("Invalid token format");
    }

    const decoded = jwt.verify(
      token.replace("Bearer ", ""),
      process.env.JWT_SECRET
    );
    req.user = decoded;

    if (decoded.clientId) {
      try {
        // Find the client by ID
        const client = await Client.findById(decoded.clientId);

        if (!client) {
          return res
            .status(401)
            .json({ message: "Client Token is invalid or expired!" });
        }
        
        // Устанавливаем req.client для использования в routes
        req.client = client;
        // If all checks pass, proceed to the next middleware
        next();
      } catch (error) {
        return res.status(500).json({ message: error.message });
      }
    } else if (decoded.adminId) {
      try {
        // Find the admin by ID
        const admin = await Admin.findById(decoded.adminId);

        if (!admin) {
          return res
            .status(401)
            .json({ message: "Admin Token is invalid or expired!" });
        }
        
        // Устанавливаем req.admin для использования в routes
        req.admin = admin;
        next();
      } catch (error) {
        return res.status(500).json({ message: error.message });
      }
    } else {
      next();
    }
  } catch (error) {
    return res.status(401).json({ message: "Wrong or expired token!" });
  }
};

module.exports = authMiddleware;
