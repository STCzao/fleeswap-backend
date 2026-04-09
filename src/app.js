const express = require("express");
const cors = require("cors");

const app = express();

// Middlewares globales
app.use(cors());
app.use(express.json());

// Rutas
const authRoutes = require("./routes/authRoutes");
app.use("/api/auth", authRoutes);
// app.use("/api/users", userRoutes);
// app.use("/api/publications", publicationRoutes);
// app.use("/api/exchanges", exchangeRoutes);
// app.use("/api/wishlist", wishlistRoutes);
// app.use("/api/notifications", notificationRoutes);

// Manejo global de errores — debe ir al final, después de todas las rutas
const errorHandler = require("./middlewares/errorHandler");
app.use(errorHandler);

module.exports = app;
