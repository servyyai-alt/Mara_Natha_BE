import express from 'express'
import { createShipping, trackShipment, checkServiceability, testAuth } from '../controllers/shippingController.js'
import { protect, adminOnly } from '../middleware/authMiddleware.js'

const router = express.Router()

router.post('/create/:orderId', protect, adminOnly, createShipping)
router.get('/test-auth', protect, adminOnly, testAuth)
router.get('/track/:awb', protect, trackShipment)
router.post('/serviceability', checkServiceability)

export default router
