import { Router } from "express";
import User from "../models/User.js";
import Property from "../models/Property.js";
import { requireUser } from "../middlewares/auth.js";

const router = Router();

// All bookmark routes require a logged-in user
router.use(requireUser);

// GET /bookmarks  – get all bookmarked properties for the current user
router.get("/", async (req, res) => {
  try {
    const user = await User.findById(req.userId).populate("bookmarks");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const bookmarks = (user.bookmarks || []).map(formatProperty);
    res.json({ success: true, bookmarks });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /bookmarks  { userId, propertyId }
router.post("/", async (req, res) => {
  try {
    const { propertyId } = req.body;
    if (!propertyId) return res.status(400).json({ success: false, message: "propertyId required" });

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    if (!user.bookmarks.map(String).includes(String(propertyId))) {
      user.bookmarks.push(propertyId);
      await user.save();
    }

    res.json({ success: true, bookmarks: user.bookmarks.map(String) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /bookmarks  { userId, propertyId }
router.delete("/", async (req, res) => {
  try {
    const { propertyId } = req.body;
    if (!propertyId) return res.status(400).json({ success: false, message: "propertyId required" });

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    user.bookmarks = user.bookmarks.filter((id) => String(id) !== String(propertyId));
    await user.save();

    res.json({ success: true, bookmarks: user.bookmarks.map(String) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

function formatProperty(doc) {
  const obj = doc.toObject ? doc.toObject() : doc;
  return {
    ...obj,
    id: obj._id,
    images: (obj.images || []).map((img) => (typeof img === "string" ? img : img.url)),
  };
}

export default router;