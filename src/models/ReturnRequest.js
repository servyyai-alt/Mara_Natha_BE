import mongoose from 'mongoose'

const returnItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, trim: true },
    price: { type: Number, min: 0, default: 0 },
    quantity: { type: Number, required: true, min: 1 },
    reasonCode: { type: String, trim: true, default: '' },
    reasonText: { type: String, trim: true, default: '' },
    condition: { type: String, trim: true, default: '' },
  },
  { _id: false }
)

const returnRequestSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, unique: true, index: true },
    items: { type: [returnItemSchema], default: [] },
    reason: { type: String, trim: true, default: '' },
    notes: { type: String, trim: true, default: '' },
    status: {
      type: String,
      enum: [
        'requested',
        'approved',
        'pickup_scheduled',
        'picked_up',
        'in_transit',
        'received',
        'qc_failed',
        'qc_passed',
        'refund_initiated',
        'refund_pending',
        'refund_processed',
        'refund_failed',
        'rejected',
        'cancelled',
      ],
      default: 'requested',
      index: true,
    },
    eligibility: {
      isEligible: { type: Boolean, default: true },
      returnWindowDays: Number,
      deliveredAt: Date,
      expiresAt: Date,
    },
    pickupAddressSnapshot: {
      fullName: String,
      phone: String,
      addressLine1: String,
      addressLine2: String,
      city: String,
      state: String,
      pincode: String,
      country: String,
    },
    shiprocket: {
      serviceability: mongoose.Schema.Types.Mixed,
      createResponse: mongoose.Schema.Types.Mixed,
      returnOrderId: String,
      shipmentId: String,
      awb: String,
      courierName: String,
      pickupScheduledAt: Date,
      error: String,
    },
    refund: {
      paymentId: String,
      refundId: String,
      amount: Number, // in paise
      currency: { type: String, default: 'INR' },
      speed: { type: String, default: 'optimum' },
      status: { type: String, enum: ['pending', 'processed', 'failed'], default: 'pending' },
      error: String,
      manualRefundDetails: {
        method: { type: String, enum: ['upi', 'bank'] },
        upiId: String,
        accountName: String,
        bankName: String,
        accountNumber: String,
        ifscCode: String,
      },
    },
    audit: [
      {
        at: { type: Date, default: Date.now },
        by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        action: String,
        meta: mongoose.Schema.Types.Mixed,
      },
    ],
  },
  { timestamps: true }
)

returnRequestSchema.index({ createdAt: -1 })

const ReturnRequest = mongoose.model('ReturnRequest', returnRequestSchema)
export default ReturnRequest
