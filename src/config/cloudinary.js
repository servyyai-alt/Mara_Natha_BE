import { v2 as cloudinary } from 'cloudinary'
import { CloudinaryStorage } from 'multer-storage-cloudinary'
import multer from 'multer'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

const sanitizeFolder = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9/_-]/g, '')
    .replace(/\/+/g, '/')
    .replace(/^\/|\/$/g, '')

export const createStorage = (defaultFolder = 'Maranatha', resourceType = 'image') => {
  return new CloudinaryStorage({
    cloudinary,
    params: (req) => {
      const requested = sanitizeFolder(req?.body?.folder)
      const folder = requested || sanitizeFolder(defaultFolder) || 'products'
      return {
        folder: `Maranatha/${folder}`,
        resource_type: resourceType,
        allowed_formats: resourceType === 'video'
          ? ['mp4', 'webm', 'mov']
          : ['jpg', 'jpeg', 'png', 'webp', 'gif'],
        transformation: resourceType === 'image'
          ? [{ quality: 'auto', fetch_format: 'auto' }]
          : undefined,
      }
    },
  })
}

export const upload = multer({
  storage: createStorage('products'),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
})

export const videoUpload = multer({
  storage: createStorage('products', 'video'),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
})

export default cloudinary
