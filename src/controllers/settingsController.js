import asyncHandler from 'express-async-handler'
import Settings from '../models/Settings.js'

const getOrCreateSettings = async () => {
  const existing = await Settings.findOne({ singleton: 'global' })
  if (existing) return existing
  return Settings.create({ singleton: 'global' })
}

const normalizeNumber = (value, fallback) => {
  if (value === undefined || value === null || value === '') return fallback
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

const buildUpdateFromFlatPayload = (payload = {}) => {
  const update = {}

  if (payload.siteName !== undefined) update['general.siteName'] = String(payload.siteName || '')
  if (payload.siteDescription !== undefined) update['general.siteDescription'] = String(payload.siteDescription || '')
  if (payload.freeShippingThreshold !== undefined) update['general.freeShippingThreshold'] = normalizeNumber(payload.freeShippingThreshold, 0)
  if (payload.shippingCharge !== undefined) update['general.shippingCharge'] = normalizeNumber(payload.shippingCharge, 0)
  if (payload.freeShippingEnabled !== undefined) update['general.freeShippingEnabled'] = Boolean(payload.freeShippingEnabled)

  if (payload.metaTitle !== undefined) update['seo.metaTitle'] = String(payload.metaTitle || '')
  if (payload.metaDescription !== undefined) update['seo.metaDescription'] = String(payload.metaDescription || '')

  if (payload.primaryColor !== undefined) update['theme.primaryColor'] = String(payload.primaryColor || '')

  if (payload.marqueeTexts !== undefined) {
    if (Array.isArray(payload.marqueeTexts)) {
      update['marketing.marqueeTexts'] = payload.marqueeTexts.map(v => String(v || '').trim()).filter(Boolean)
    } else {
      const lines = String(payload.marqueeTexts || '')
        .split('\n')
        .map(v => v.trim())
        .filter(Boolean)
      update['marketing.marqueeTexts'] = lines
    }
  }
  if (payload.couponCode !== undefined) update['marketing.couponCode'] = String(payload.couponCode || '').trim()

  if (payload.heroImageUrl !== undefined) update['homepage.heroImage.url'] = String(payload.heroImageUrl || '').trim()
  if (payload.heroImagePublicId !== undefined) update['homepage.heroImage.publicId'] = String(payload.heroImagePublicId || '').trim()
  if (payload.heroImages !== undefined) {
    const arr = Array.isArray(payload.heroImages) ? payload.heroImages : []
    update['homepage.heroImages'] = arr
      .map((x) => ({
        url: String(x?.url || '').trim(),
        publicId: String(x?.publicId || x?.public_id || '').trim(),
      }))
      .filter((x) => Boolean(x.url))
  }

  if (payload.razorpayKeyId !== undefined) update['integrations.razorpay.keyId'] = String(payload.razorpayKeyId || '')
  if (payload.shiprocketEmail !== undefined) update['integrations.shiprocket.email'] = String(payload.shiprocketEmail || '')
  if (payload.shiprocketPickupLocation !== undefined) update['integrations.shiprocket.pickupLocation'] = String(payload.shiprocketPickupLocation || '')
  if (payload.cloudinaryCloudName !== undefined) update['integrations.cloudinary.cloudName'] = String(payload.cloudinaryCloudName || '')
  if (payload.cloudinaryApiKey !== undefined) update['integrations.cloudinary.apiKey'] = String(payload.cloudinaryApiKey || '')

  // Secrets: only update when non-empty string is provided (prevents accidental wipe).
  if (typeof payload.razorpayKeySecret === 'string' && payload.razorpayKeySecret.trim() !== '') {
    update['integrations.razorpay.keySecret'] = payload.razorpayKeySecret.trim()
  }
  if (typeof payload.shiprocketPassword === 'string' && payload.shiprocketPassword.trim() !== '') {
    update['integrations.shiprocket.password'] = payload.shiprocketPassword
  }
  if (typeof payload.cloudinaryApiSecret === 'string' && payload.cloudinaryApiSecret.trim() !== '') {
    update['integrations.cloudinary.apiSecret'] = payload.cloudinaryApiSecret.trim()
  }

  return update
}

const sanitizeForAdmin = (doc) => {
  const settings = doc.toObject({ virtuals: false })
  const hasRazorpayKeySecret = Boolean(settings.integrations?.razorpay?.keySecret)
  const hasShiprocketPassword = Boolean(settings.integrations?.shiprocket?.password)
  const hasCloudinaryApiSecret = Boolean(settings.integrations?.cloudinary?.apiSecret)

  // Never send secrets back to the client (even for admin UI).
  if (settings.integrations?.razorpay) settings.integrations.razorpay.keySecret = ''
  if (settings.integrations?.shiprocket) settings.integrations.shiprocket.password = ''
  if (settings.integrations?.cloudinary) settings.integrations.cloudinary.apiSecret = ''

  return {
    ...settings,
    secrets: { hasRazorpayKeySecret, hasShiprocketPassword, hasCloudinaryApiSecret },
  }
}

export const adminGetSettings = asyncHandler(async (req, res) => {
  const doc = await getOrCreateSettings()
  res.json({ success: true, settings: sanitizeForAdmin(doc) })
})

export const adminUpdateSettings = asyncHandler(async (req, res) => {
  await getOrCreateSettings()

  const update = buildUpdateFromFlatPayload(req.body || {})
  update.updatedBy = req.user?._id

  const doc = await Settings.findOneAndUpdate(
    { singleton: 'global' },
    { $set: update },
    { new: true, runValidators: true }
  )

  res.json({ success: true, settings: sanitizeForAdmin(doc) })
})

export const getPublicSettings = asyncHandler(async (req, res) => {
  const doc = await getOrCreateSettings()
  res.json({
    success: true,
    settings: {
      general: doc.general,
      seo: doc.seo,
      theme: doc.theme,
      marketing: doc.marketing,
      homepage: {
        heroImage: doc.homepage?.heroImage,
        heroImages: doc.homepage?.heroImages || [],
      },
    },
  })
})
