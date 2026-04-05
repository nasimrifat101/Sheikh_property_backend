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
    // Cloudinary image objects: { url, publicId }
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

export default mongoose.model("Property", propertySchema);