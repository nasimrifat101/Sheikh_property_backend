import { Router } from "express";
import Property from "../models/Property.js";
import { upload, cloudinary } from "../middlewares/cloudinary.js";
import { requireAdmin } from "../middlewares/auth.js";

const router = Router();

// ─── Public ───────────────────────────────────────────────────────────────────

// GET /properties
// Optimizations:
//   1. Sort done in DB using compound index (status + createdAt) — no JS sort needed
//   2. Lean() returns plain JS objects, skips Mongoose hydration overhead (~30% faster)
//   3. List projection excludes heavy fields not needed in cards
router.get("/", async (req, res) => {
  try {
    // Status priority sort: available → sold → rented
    // MongoDB can't do custom enum order natively, so we sort by createdAt DESC
    // grouped by status using aggregation — or keep it simple and sort in JS
    // after a lean() query (collection is small, this is fine at <10k docs)
    const properties = await Property.find()
      .select("name location sqft pricePerSqft electricity status images advance createdAt")
      .sort({ createdAt: -1 })
      .lean(); // ← plain objects, no Mongoose overhead

    // Status priority sort (JS, not DB — custom enum order not worth aggregation complexity)
    const priority = { available: 1, sold: 2, rented: 3 };
    properties.sort((a, b) => {
      const pa = priority[a.status?.toLowerCase()] ?? 4;
      const pb = priority[b.status?.toLowerCase()] ?? 4;
      if (pa !== pb) return pa - pb;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    res.json({ success: true, properties: properties.map(formatProperty) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /properties/:id
// Full document for detail page — no projection restriction here
router.get("/:id", async (req, res) => {
  try {
    const property = await Property.findById(req.params.id).lean();
    if (!property) {
      return res.status(404).json({ success: false, message: "Property not found" });
    }
    res.json({ success: true, property: formatProperty(property) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Admin only ───────────────────────────────────────────────────────────────

// POST /properties
router.post("/", requireAdmin, upload.array("images", 10), async (req, res) => {
  try {
    const {
      name, location, sqft, pricePerSqft, electricity,
      status, description, features, facebookVideoLink, advance,
    } = req.body;

    const images = (req.files || []).map((f) => ({
      url: f.path,
      publicId: f.filename,
    }));

    const property = await Property.create({
      name,
      location,
      sqft: Number(sqft),
      pricePerSqft: Number(pricePerSqft),
      electricity,
      status: status || "available",
      description,
      features: parseFeatures(features),
      images,
      facebookVideoLink: facebookVideoLink || "",
      advance: advance || "",
    });

    res.status(201).json({ success: true, property: formatProperty(property.toObject()) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /properties/:id
router.put("/:id", requireAdmin, upload.array("images", 10), async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) return res.status(404).json({ success: false, message: "Property not found" });

    const {
      name, location, sqft, pricePerSqft, electricity,
      status, description, features, facebookVideoLink, advance, replaceImages,
    } = req.body;

    let images = property.images;

    if (req.files && req.files.length > 0) {
      const newImages = req.files.map((f) => ({ url: f.path, publicId: f.filename }));

      if (replaceImages === "true") {
        // Delete old Cloudinary images in parallel — don't await serially
        await Promise.allSettled(
          property.images.map((img) => cloudinary.uploader.destroy(img.publicId))
        );
        images = newImages;
      } else {
        images = [...property.images, ...newImages];
      }
    }

    const updated = await Property.findByIdAndUpdate(
      req.params.id,
      {
        name, location,
        sqft: Number(sqft),
        pricePerSqft: Number(pricePerSqft),
        electricity, status, description,
        features: parseFeatures(features),
        images,
        facebookVideoLink: facebookVideoLink || "",
        advance: advance || "",
      },
      { new: true, lean: true } // ← lean on findByIdAndUpdate too
    );

    res.json({ success: true, property: formatProperty(updated) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /properties/:id/images/:publicId
router.delete("/:id/images/:publicId", requireAdmin, async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) return res.status(404).json({ success: false, message: "Property not found" });

    const publicId = decodeURIComponent(req.params.publicId);
    await cloudinary.uploader.destroy(publicId).catch(() => {});

    property.images = property.images.filter((img) => img.publicId !== publicId);
    await property.save();

    res.json({ success: true, property: formatProperty(property.toObject()) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /properties/:id
router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) return res.status(404).json({ success: false, message: "Property not found" });

    // Delete all Cloudinary images in parallel
    await Promise.allSettled(
      property.images.map((img) => cloudinary.uploader.destroy(img.publicId))
    );

    await property.deleteOne();
    res.json({ success: true, message: "Property deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatProperty(obj) {
  // lean() already returns plain object, no need for toObject()
  return {
    ...obj,
    id: obj._id,
    images: (obj.images || []).map((img) => (typeof img === "string" ? img : img.url)),
  };
}

function parseFeatures(features) {
  if (!features) return [];
  if (Array.isArray(features)) return features;
  try {
    return JSON.parse(features);
  } catch {
    return features.split(",").map((f) => f.trim()).filter(Boolean);
  }
}

export default router;