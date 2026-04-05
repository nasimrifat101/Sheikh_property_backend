import { Router } from "express";
import Admin from "../models/Admin.js";
import User from "../models/User.js";
import { requireAdmin } from "../middlewares/auth.js";

const router = Router();

// POST /admin/seed  – one-time: create the admin account from env vars
// Call this once after deploy, then remove or protect it
router.post("/seed", async (req, res) => {
  try {
    const { username, password } = req.body;

    // Require the seeding secret to prevent misuse
    if (req.headers["x-seed-secret"] !== process.env.JWT_SECRET) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const adminUsername = username || process.env.ADMIN_USERNAME;
    const adminPassword = password || process.env.ADMIN_PASSWORD;

    if (!adminUsername || !adminPassword) {
      return res.status(400).json({ success: false, message: "ADMIN_USERNAME and ADMIN_PASSWORD must be set in .env" });
    }

    const exists = await Admin.findOne({ username: adminUsername });
    if (exists) {
      return res.status(409).json({ success: false, message: "Admin already exists" });
    }

    const admin = await Admin.create({ username: adminUsername, password: adminPassword });
    res.status(201).json({ success: true, message: "Admin created", username: admin.username });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /admin/users  – list all users (admin only)
router.get("/users", requireAdmin, async (req, res) => {
  try {
    const users = await User.find().select("-__v").sort({ createdAt: -1 });
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;