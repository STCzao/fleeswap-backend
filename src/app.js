const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");
const cookieParser = require("cookie-parser");

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const errorHandler = require("./middlewares/errorHandler");

const app = express();

// Seguridad — headers HTTP seguros
app.use(helmet());

// Prevención de NoSQL injection — compatible con Express 5 (req.query es read-only)
app.use((req, _res, next) => {
  if (req.body) req.body = mongoSanitize.sanitize(req.body);
  next();
});

// CORS — solo permite el origen del frontend
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
}));

// Parseo de cookies — necesario para leer el refreshToken httpOnly en cada request
app.use(cookieParser());

// Parseo de JSON — límite de 10kb para prevenir payload attacks
app.use(express.json({ limit: "10kb" }));

// Rutas
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
// app.use("/api/publications", publicationRoutes);
// app.use("/api/exchanges", exchangeRoutes);
// app.use("/api/wishlist", wishlistRoutes);
// app.use("/api/notifications", notificationRoutes);

// Manejo global de errores — debe ir al final, después de todas las rutas
app.use(errorHandler);

module.exports = app;
