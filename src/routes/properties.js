import { Router } from "express";
import Property from "../models/Property.js";
import { upload, cloudinary } from "../middlewares/cloudinary.js";
import { requireAdmin } from "../middlewares/auth.js";

const router = Router();

// ─── Public ──────────────────────────────────────────────────────────────────

// GET /properties
router.get("/", async (req, res) => {
  try {
    const properties = await Property.find().sort({ createdAt: -1 });

    // Shape images to just URL strings for frontend compatibility
    const shaped = properties.map(formatProperty);

    res.json({ success: true, properties: shaped });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /properties/:id
router.get("/:id", async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) {
      return res.status(404).json({ success: false, message: "Property not found" });
    }
    res.json({ success: true, property: formatProperty(property) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Admin only ───────────────────────────────────────────────────────────────

// POST /properties  (multipart/form-data with up to 10 images)
router.post("/", requireAdmin, upload.array("images", 10), async (req, res) => {
  try {
    const { name, location, sqft, pricePerSqft, electricity, status, description, features, facebookVideoLink, advance } = req.body;

    // req.files are already uploaded to Cloudinary by multer-storage-cloudinary
    const images = (req.files || []).map((f) => ({
      url: f.path,           // Cloudinary secure URL
      publicId: f.filename,  // Cloudinary public_id
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

    res.status(201).json({ success: true, property: formatProperty(property) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /properties/:id  (can replace all images, or keep existing + add new)
router.put("/:id", requireAdmin, upload.array("images", 10), async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) return res.status(404).json({ success: false, message: "Property not found" });

    const { name, location, sqft, pricePerSqft, electricity, status, description, features, facebookVideoLink, advance, replaceImages } = req.body;

    // Build image list
    let images = property.images;

    if (req.files && req.files.length > 0) {
      const newImages = req.files.map((f) => ({
        url: f.path,
        publicId: f.filename,
      }));

      if (replaceImages === "true") {
        // Delete old images from Cloudinary
        for (const img of property.images) {
          await cloudinary.uploader.destroy(img.publicId).catch(() => {});
        }
        images = newImages;
      } else {
        // Append new images to existing
        images = [...property.images, ...newImages];
      }
    }

    const updated = await Property.findByIdAndUpdate(
      req.params.id,
      {
        name,
        location,
        sqft: Number(sqft),
        pricePerSqft: Number(pricePerSqft),
        electricity,
        status,
        description,
        features: parseFeatures(features),
        images,
        facebookVideoLink: facebookVideoLink || "",
        advance: advance || "",
      },
      { new: true }
    );

    res.json({ success: true, property: formatProperty(updated) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /properties/:id/images/:publicId  – remove one image
router.delete("/:id/images/:publicId", requireAdmin, async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) return res.status(404).json({ success: false, message: "Property not found" });

    const publicId = decodeURIComponent(req.params.publicId);
    await cloudinary.uploader.destroy(publicId).catch(() => {});

    property.images = property.images.filter((img) => img.publicId !== publicId);
    await property.save();

    res.json({ success: true, property: formatProperty(property) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /properties/:id
router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) return res.status(404).json({ success: false, message: "Property not found" });

    // Delete all images from Cloudinary
    for (const img of property.images) {
      await cloudinary.uploader.destroy(img.publicId).catch(() => {});
    }

    await property.deleteOne();
    res.json({ success: true, message: "Property deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Flatten property for the frontend.
 * Frontend expects `images` to be an array of URL strings (from old Supabase shape).
 */
function formatProperty(doc) {
  const obj = doc.toObject ? doc.toObject() : doc;
  return {
    ...obj,
    id: obj._id,
    images: (obj.images || []).map((img) => (typeof img === "string" ? img : img.url)),
    createdAt: obj.createdAt,
  };
}

/** Features can arrive as a JSON string or a plain array from FormData */
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