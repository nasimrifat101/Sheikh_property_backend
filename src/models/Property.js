import mongoose from "mongoose";

const propertySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    location: {
      type: String,
      required: true,
      trim: true,
    },
    sqft: {
      type: Number,
      required: true,
    },
    pricePerSqft: {
      type: Number,
      required: true,
    },
    electricity: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["available", "rented", "sold"],
      default: "available",
    },
    description: {
      type: String,
      default: "",
    },
    features: {
      type: [String],
      default: [],
    },
    images: [
      {
        url: { type: String, required: true },
        publicId: { type: String, required: true },
      },
    ],
    facebookVideoLink: {
      type: String,
      default: "",
    },
    advance: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
// List query: GET /properties sorts by status priority + createdAt
// Compound index covers both sort fields in one scan — no COLLSCAN
propertySchema.index({ status: 1, createdAt: -1 });

// Single property lookup by _id is already indexed (default), no extra needed

export default mongoose.model("Property", propertySchema);