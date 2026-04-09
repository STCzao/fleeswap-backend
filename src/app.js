const express = require("express");
const cors = require("cors");

const app = express();

// Middlewares globales
app.use(cors());
app.use(express.json());

// Rutas
// app.use("/api/auth", authRoutes);
// app.use("/api/users", userRoutes);
// app.use("/api/publications", publicationRoutes);
// app.use("/api/exchanges", exchangeRoutes);
// app.use("/api/wishlist", wishlistRoutes);
// app.use("/api/notifications", notificationRoutes);

module.exports = app;
