import axios from 'axios'
import Settings from '../models/Settings.js'
import User from '../models/User.js'

const SHIPROCKET_BASE = 'https://apiv2.shiprocket.in/v1/external'

let tokenCache = { token: null, expiresAt: 0, cacheKey: null }
const serviceabilityCache = new Map()

const normalizeIndianPhone10 = (value) => {
  const digits = String(value || '').replace(/\D/g, '')
  if (!digits) return ''
  // Common cases: "+91XXXXXXXXXX", "91XXXXXXXXXX", "0XXXXXXXXXX", "XXXXXXXXXX"
  if (digits.length === 10) return digits
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1)
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2)
  if (digits.length > 10) return digits.slice(-10)
  return digits // will fail validation later
}

const normalizePincode = (value) => {
  return String(value || '').replace(/\s+/g, '')
}

const getShiprocketConfig = async () => {
  const doc = await Settings.findOne({ singleton: 'global' })
    .select('integrations.shiprocket')
    .lean()

  const email = doc?.integrations?.shiprocket?.email || process.env.SHIPROCKET_EMAIL || ''
  const password = doc?.integrations?.shiprocket?.password || process.env.SHIPROCKET_PASSWORD || ''
  const pickupLocation = doc?.integrations?.shiprocket?.pickupLocation || process.env.SHIPROCKET_PICKUP_LOCATION || 'Primary'

  return { email, password, pickupLocation }
}

const getToken = async () => {
  const { email, password } = await getShiprocketConfig()
  const cacheKey = `${email}::${password ? 'set' : 'unset'}`

  if (!email || !password) {
    const err = new Error('Shiprocket credentials not configured')
    err.statusCode = 500
    throw err
  }

  if (tokenCache.token && Date.now() < tokenCache.expiresAt) {
    if (tokenCache.cacheKey === cacheKey) return tokenCache.token
  }

  const res = await axios.post(`${SHIPROCKET_BASE}/auth/login`, { email, password })

  tokenCache.token = res.data.token
  tokenCache.expiresAt = Date.now() + 9 * 24 * 60 * 60 * 1000 // 9 days
  tokenCache.cacheKey = cacheKey
  return tokenCache.token
}

const shiprocketClient = async () => {
  const token = await getToken()
  return axios.create({
    baseURL: SHIPROCKET_BASE,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  })
}

export const createShiprocketOrder = async (order) => {
  const client = await shiprocketClient()
  const { shippingAddress: addr, orderItems } = order

  const { pickupLocation } = await getShiprocketConfig()

  let billingEmail = ''
  if (order.user?.email) billingEmail = order.user.email
  if (!billingEmail && order.user) {
    const userDoc = await User.findById(order.user).select('email').lean()
    billingEmail = userDoc?.email || ''
  }
  if (!billingEmail) billingEmail = process.env.ADMIN_EMAIL || 'support@Maranatha.com'

  const payload = {
    order_id: order._id.toString(),
    order_date: new Date(order.createdAt).toISOString().split('T')[0],
    pickup_location: pickupLocation,
    billing_customer_name: addr.fullName,
    billing_last_name: '',
    billing_address: addr.addressLine1,
    billing_address_2: addr.addressLine2 || '',
    billing_city: addr.city,
    billing_pincode: addr.pincode,
    billing_state: addr.state,
    billing_country: 'India',
    billing_email: billingEmail,
    billing_phone: addr.phone,
    shipping_is_billing: true,
    order_items: orderItems.map(item => ({
      name: item.name,
      sku: item.product?.toString(),
      units: item.quantity,
      selling_price: item.price,
      discount: 0,
      tax: '',
    })),
    payment_method: order.paymentMethod === 'cod' ? 'COD' : 'Prepaid',
    sub_total: order.itemsPrice,
    length: 10,
    breadth: 10,
    height: 10,
    weight: 0.5,
  }

  try {
    const res = await client.post('/orders/create/adhoc', payload)
    return res.data
  } catch (err) {
    const apiMessage = err.response?.data?.message || err.response?.data?.error || err.message
    const e = new Error(`Shiprocket create order failed: ${apiMessage}`)
    e.statusCode = err.response?.status || 500
    e.details = err.response?.data
    throw e
  }
}

export const trackOrder = async (awbCode) => {
  const client = await shiprocketClient()
  const res = await client.get(`/courier/track/awb/${awbCode}`)
  return res.data
}

export const getServiceability = async ({ pickupPincode, deliveryPincode, weight }) => {
  const client = await shiprocketClient()

  const envPincode = (process.env.RETURN_WAREHOUSE_PINCODE || '').replace(/\s+/g, '')
  const finalPickupPincode = (pickupPincode || '').replace(/\s+/g, '') || envPincode
  const finalDeliveryPincode = normalizePincode(deliveryPincode)
  const finalWeight = Number(weight || 0.5)
  const cacheKey = `${finalPickupPincode}::${finalDeliveryPincode}::${finalWeight}`
  const cached = serviceabilityCache.get(cacheKey)

  if (cached && cached.expiresAt > Date.now()) {
    return cached.data
  }

  if (!finalPickupPincode) {
    const err = new Error('Pickup pincode is required for serviceability check')
    err.statusCode = 400
    throw err
  }

  try {
    const res = await client.get('/courier/serviceability', {
      params: {
        pickup_postcode: finalPickupPincode,
        delivery_postcode: finalDeliveryPincode,
        weight: finalWeight,
        cod: 1,
      },
    })
    serviceabilityCache.set(cacheKey, {
      data: res.data,
      expiresAt: Date.now() + 10 * 60 * 1000,
    })
    return res.data
  } catch (err) {
    if (cached?.data) return cached.data

    const status = err.response?.status || 500
    const apiMessage = err.response?.data?.message || err.response?.data?.error || err.message
    const e = new Error(
      status === 429
        ? 'Shiprocket serviceability is rate-limited right now. Please try again in a moment.'
        : `Shiprocket serviceability failed: ${apiMessage}`
    )
    e.statusCode = status
    e.details = err.response?.data
    throw e
  }
}

export const cancelShiprocketOrder = async (ids) => {
  const client = await shiprocketClient()
  const res = await client.post('/orders/cancel', { ids })
  return res.data
}

const getReturnWarehouse = () => {
  const name = process.env.RETURN_WAREHOUSE_NAME || process.env.WAREHOUSE_NAME || ''
  const phone = process.env.RETURN_WAREHOUSE_PHONE || process.env.WAREHOUSE_PHONE || ''
  const addressLine1 = process.env.RETURN_WAREHOUSE_ADDRESS1 || ''
  const addressLine2 = process.env.RETURN_WAREHOUSE_ADDRESS2 || ''
  const city = process.env.RETURN_WAREHOUSE_CITY || ''
  const state = process.env.RETURN_WAREHOUSE_STATE || ''
  const pincode = process.env.RETURN_WAREHOUSE_PINCODE || ''
  const country = process.env.RETURN_WAREHOUSE_COUNTRY || 'India'

  return { name, phone, addressLine1, addressLine2, city, state, pincode, country }
}

export const getReturnServiceability = async ({ pickupPincode, deliveryPincode, weight }) => {
  return getServiceability({ pickupPincode, deliveryPincode, weight })
}

export const createShiprocketReturnOrder = async ({ order, returnRequest, items }) => {
  const client = await shiprocketClient()

  const addr = order.shippingAddress || {}
  const warehouse = getReturnWarehouse()
  const missing = []
  if (!warehouse.pincode) missing.push('RETURN_WAREHOUSE_PINCODE')
  if (!warehouse.addressLine1) missing.push('RETURN_WAREHOUSE_ADDRESS1')
  if (!warehouse.city) missing.push('RETURN_WAREHOUSE_CITY')
  if (!warehouse.state) missing.push('RETURN_WAREHOUSE_STATE')
  if (!warehouse.phone) missing.push('RETURN_WAREHOUSE_PHONE')
  if (missing.length) {
    const e = new Error(`Return warehouse address is not configured. Missing: ${missing.join(', ')}`)
    e.statusCode = 500
    throw e
  }

  const pickupPhone = normalizeIndianPhone10(addr.phone)
  if (!pickupPhone || pickupPhone.length !== 10) {
    const e = new Error('Customer pickup phone must be 10 digits')
    e.statusCode = 400
    throw e
  }

  const warehousePhone = normalizeIndianPhone10(warehouse.phone)
  if (!warehousePhone || warehousePhone.length !== 10) {
    const e = new Error('Return warehouse phone must be 10 digits (RETURN_WAREHOUSE_PHONE)')
    e.statusCode = 500
    throw e
  }

  const pickupPincode = normalizePincode(addr.pincode)
  if (!pickupPincode || !/^\d{6}$/.test(pickupPincode)) {
    const e = new Error(`Customer pickup pincode must be exactly 6 digits. Invalid pincode: "${addr.pincode}"`)
    e.statusCode = 400
    throw e
  }

  const warehousePincode = normalizePincode(warehouse.pincode)
  if (!warehousePincode || !/^\d{6}$/.test(warehousePincode)) {
    const e = new Error(`Return warehouse pincode must be exactly 6 digits. Invalid pincode: "${warehouse.pincode}"`)
    e.statusCode = 500
    throw e
  }

  const payload = {
    order_id: `${order._id.toString()}-RET`,
    order_date: new Date().toISOString().split('T')[0],
    pickup_customer_name: addr.fullName,
    pickup_last_name: '',
    pickup_address: addr.addressLine1,
    pickup_address_2: addr.addressLine2 || '',
    pickup_city: addr.city,
    pickup_state: addr.state,
    pickup_country: addr.country || 'India',
    pickup_pincode: pickupPincode,
    pickup_email: order.user?.email || process.env.ADMIN_EMAIL || 'support@Maranatha.com',
    pickup_phone: pickupPhone,
    shipping_customer_name: warehouse.name || 'Maranatha Warehouse',
    shipping_last_name: '',
    shipping_address: warehouse.addressLine1,
    shipping_address_2: warehouse.addressLine2 || '',
    shipping_city: warehouse.city,
    shipping_state: warehouse.state,
    shipping_country: warehouse.country || 'India',
    shipping_pincode: warehousePincode,
    shipping_phone: warehousePhone,
    order_items: (items || []).map((it) => ({
      name: it.name,
      sku: it.product?.toString(),
      units: it.quantity,
      selling_price: Number(it.price || 0),
      discount: 0,
      tax: '',
    })),
    payment_method: 'Prepaid',
    sub_total: (items || []).reduce((sum, it) => sum + (Number(it.price || 0) * Number(it.quantity || 0)), 0),
    length: 10,
    breadth: 10,
    height: 10,
    weight: 0.5,
    return_reason: (() => {
      const validReasons = [
        'bought by mistake',
        'better price available',
        'performance or quality not adequate',
        'incompatible or not useful',
        'product damaged, but shipping box ok',
        'item arrived too late',
        'missing parts or accessories',
        'both product and shipping box damaged',
        'wrong item was sent',
        'item defective or doesn\'t work',
        'no longer needed',
        'didn\'t approve purchase',
        'inaccurate website description',
        'return against replacement',
        'delay refund',
        'delivered late',
        'product does not match description on website',
        'both product & outer box damaged',
        'defective or does not work',
        'product damaged, but outer box ok',
        'incorrect item delivered',
        'product performance/quality is not up to my expectations',
        'other',
        'changed my mind',
        'does not fit',
        'size not as expected',
        'item is damaged',
        'received wrong item',
        'parcel damaged on arrival',
        'quality not as expected',
        'missing item or accessories',
        'performance not adequate',
        'not as described',
        'arrived too late',
        'order not received',
        'empty package',
        'wrong item or wrong colour was sent',
        'item defective',
        'expired',
        'spoilt or does not work',
        'items or parts missing',
        'size or quantity issues',
        'status as delivered but order not received',
        'n/a'
      ];
      const raw = String(returnRequest?.reason || '').trim().toLowerCase();
      return validReasons.find(r => r === raw) || 'other';
    })(),
  }

  try {
    const res = await client.post('/orders/create/return', payload)
    return res.data
  } catch (err) {
    const apiMessage = err.response?.data?.message || err.response?.data?.error || err.message
    const e = new Error(`Shiprocket create return failed: ${apiMessage}`)
    e.statusCode = err.response?.status || 500
    e.details = err.response?.data
    throw e
  }
}

export const testShiprocketAuth = async () => {
  const { email, pickupLocation } = await getShiprocketConfig()
  const token = await getToken()
  return { email, pickupLocation, tokenPresent: Boolean(token) }
}
