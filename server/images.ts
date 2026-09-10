import { v2 as cloudinary } from "cloudinary";
import { env } from "./env.js";

function configured() {
  const config = env();
  return Boolean(config.CLOUDINARY_CLOUD_NAME && config.CLOUDINARY_API_KEY && config.CLOUDINARY_API_SECRET);
}

function configure() {
  const config = env();
  cloudinary.config({
    cloud_name: config.CLOUDINARY_CLOUD_NAME,
    api_key: config.CLOUDINARY_API_KEY,
    api_secret: config.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

export async function uploadProductImage(dataUri: string, productId: string) {
  if (!configured()) throw new Error("IMAGE_STORAGE_UNCONFIGURED");
  if (!dataUri.startsWith("data:image/")) throw new Error("INVALID_IMAGE");
  configure();
  const result = await cloudinary.uploader.upload(dataUri, {
    folder: `hss/products/${productId}`,
    resource_type: "image",
    transformation: [{ quality: "auto", fetch_format: "auto" }],
  });
  return { url: result.secure_url, publicId: result.public_id, width: result.width, height: result.height };
}

export async function deleteProductImage(publicId: string) {
  if (!configured()) throw new Error("IMAGE_STORAGE_UNCONFIGURED");
  configure();
  return cloudinary.uploader.destroy(publicId, { resource_type: "image" });
}