import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import authRoutes from "./routes/auth.js";
import propertyRoutes from "./routes/properties.js";
import bookmarkRoutes from "./routes/bookmarks.js";
import adminRoutes from "./routes/admin.js";

dotenv.config();

const app = express();

// ─── CORS ─────────────────────────────────────────────────────────────────────
// Safari sends OPTIONS preflight differently — explicit handler required.
// origin function handles both exact match and missing origin (mobile webviews).
const allowedOrigins = [
  'https://sheikhpropertyservice.vercel.app',
  'http://localhost:5173',
  'http://localhost:4173',
];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin: native mobile webviews, curl, Postman
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked: ${origin}`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  // Safari requires explicit expose for Authorization header reads
  exposedHeaders: ['Authorization'],
  optionsSuccessStatus: 200, // IE11 + some Safari versions need 200, not 204
};

// Must be BEFORE routes. OPTIONS wildcard handles all preflight.
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // explicit preflight for Safari

// ─── Body parsers ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/auth", authRoutes);
app.use("/properties", propertyRoutes);
app.use("/bookmarks", bookmarkRoutes);
app.use("/admin", adminRoutes);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/", (_req, res) => {
  res.json({ success: true, message: "Sheikh Property API is running" });
});

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: "Internal server error" });
});


export default app;