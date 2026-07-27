import nodemailer from 'nodemailer'

const boolFromEnv = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback
  const v = String(value).toLowerCase().trim()
  if (['1', 'true', 'yes', 'y'].includes(v)) return true
  if (['0', 'false', 'no', 'n'].includes(v)) return false
  return fallback
}

const getMailConfig = () => {
  const host = process.env.SMTP_HOST || ''
  const port = Number(process.env.SMTP_PORT || 587)
  const secure = boolFromEnv(process.env.SMTP_SECURE, port === 465)
  const user = process.env.SMTP_USER || ''
  const pass = process.env.SMTP_PASS || ''
  const from = process.env.SMTP_FROM || process.env.ADMIN_EMAIL || user
  const adminEmail = process.env.ADMIN_EMAIL || ''
  const appName = process.env.APP_NAME || 'Maranatha'

  return { host, port, secure, user, pass, from, adminEmail, appName }
}

const isMailConfigured = (cfg) =>
  Boolean(cfg.host && cfg.port && cfg.user && cfg.pass && cfg.from)

const createTransporter = (cfg) => nodemailer.createTransport({
  host: cfg.host,
  port: cfg.port,
  secure: cfg.secure,
  auth: { user: cfg.user, pass: cfg.pass },
})

export const verifySmtpConnection = async () => {
  const cfg = getMailConfig()
  if (!isMailConfigured(cfg)) {
    console.log("⚠️ SMTP is not configured completely in environment variables.");
    return;
  }
  try {
    const transporter = createTransporter(cfg)
    console.log("Verifying SMTP connection...");
    await transporter.verify()
    console.log("✅ SMTP connection is verified successfully!");
  } catch (error) {
    console.error("❌ SMTP Transporter verification failed:", error);
  }
}

const formatMoney = (n) => {
  const num = Number(n || 0)
  return `₹${num.toLocaleString('en-IN')}`
}

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')

const renderOrderHtml = ({ appName, order, user, isAdmin }) => {
  const orderIdShort = order._id?.toString()?.slice(-8)?.toUpperCase()
  const itemsRows = (order.orderItems || []).map((item) => `
    <tr>
      <td style="padding:12px;border-bottom:1px solid #eef2f7;">
        <div style="font-weight:600;color:#0f172a;">${escapeHtml(item.name)}</div>
        <div style="color:#64748b;font-size:12px;margin-top:2px;">Qty: ${escapeHtml(item.quantity)} · Price: ${escapeHtml(formatMoney(item.price))}</div>
      </td>
      <td style="padding:12px;border-bottom:1px solid #eef2f7;text-align:right;font-weight:600;color:#0f172a;">
        ${escapeHtml(formatMoney((Number(item.price) || 0) * (Number(item.quantity) || 0)))}
      </td>
    </tr>
  `).join('')

  const addr = order.shippingAddress || {}
  const paymentStatus = order.isPaid ? 'Paid' : 'Pending'
  const placedOn = order.createdAt ? new Date(order.createdAt).toLocaleString('en-IN') : ''

  const userBlock = isAdmin ? `
    <h3 style="margin:24px 0 8px;color:#0f172a;">Customer</h3>
    <div style="color:#334155;font-size:14px;line-height:1.5">
      <div><strong>Name:</strong> ${escapeHtml(user?.name || '')}</div>
      <div><strong>Email:</strong> ${escapeHtml(user?.email || '')}</div>
      <div><strong>Phone:</strong> ${escapeHtml(user?.phone || '')}</div>
    </div>
  ` : ''

  return `
  <div style="background:#f8fafc;padding:24px 0;">
    <div style="max-width:720px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
      <div style="padding:20px 24px;background:linear-gradient(135deg,#f97316,#ea580c);color:#fff;">
        <div style="font-size:18px;font-weight:800;letter-spacing:.2px;">${escapeHtml(appName)}</div>
        <div style="margin-top:8px;font-size:14px;opacity:.95;">
          ${isAdmin ? 'New order received' : 'Order confirmation'}
        </div>
      </div>

      <div style="padding:22px 24px;">
        <div style="display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;">
          <div>
            <div style="color:#64748b;font-size:12px;letter-spacing:.12em;text-transform:uppercase;">Order</div>
            <div style="font-weight:800;color:#0f172a;font-size:18px;margin-top:4px;">#${escapeHtml(orderIdShort)}</div>
            <div style="color:#64748b;font-size:12px;margin-top:6px;">Placed: ${escapeHtml(placedOn)}</div>
          </div>
          <div style="text-align:right;">
            <div style="color:#64748b;font-size:12px;letter-spacing:.12em;text-transform:uppercase;">Payment</div>
            <div style="font-weight:700;color:#0f172a;font-size:14px;margin-top:4px;">${escapeHtml(paymentStatus)}</div>
            <div style="color:#64748b;font-size:12px;margin-top:6px;">Status: ${escapeHtml(order.orderStatus)}</div>
          </div>
        </div>

        ${userBlock}

        <h3 style="margin:24px 0 8px;color:#0f172a;">Shipping address</h3>
        <div style="color:#334155;font-size:14px;line-height:1.5">
          <div style="font-weight:700">${escapeHtml(addr.fullName || '')}</div>
          <div>${escapeHtml(addr.addressLine1 || '')}${addr.addressLine2 ? `, ${escapeHtml(addr.addressLine2)}` : ''}</div>
          <div>${escapeHtml(addr.city || '')}, ${escapeHtml(addr.state || '')} ${escapeHtml(addr.pincode || '')}</div>
          <div>${escapeHtml(addr.country || 'India')}</div>
          <div style="margin-top:6px;"><strong>Phone:</strong> ${escapeHtml(addr.phone || user?.phone || '')}</div>
        </div>

        <h3 style="margin:24px 0 8px;color:#0f172a;">Items</h3>
        <table style="width:100%;border-collapse:collapse;border:1px solid #eef2f7;border-radius:12px;overflow:hidden;">
          <thead>
            <tr style="background:#f1f5f9;">
              <th style="text-align:left;padding:12px;color:#475569;font-size:12px;letter-spacing:.08em;text-transform:uppercase;">Product</th>
              <th style="text-align:right;padding:12px;color:#475569;font-size:12px;letter-spacing:.08em;text-transform:uppercase;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows || '<tr><td style="padding:12px;">(No items)</td><td></td></tr>'}
          </tbody>
        </table>

        <div style="margin-top:16px;border-top:1px dashed #e2e8f0;padding-top:14px;">
          <div style="display:flex;justify-content:space-between;color:#334155;font-size:14px;">
            <span>Items</span><span>${escapeHtml(formatMoney(order.itemsPrice))}</span>
          </div>
          <div style="display:flex;justify-content:space-between;color:#334155;font-size:14px;margin-top:6px;">
            <span>Shipping</span><span>${escapeHtml(formatMoney(order.shippingPrice))}</span>
          </div>
          <div style="display:flex;justify-content:space-between;color:#334155;font-size:14px;margin-top:6px;">
            <span>Tax</span><span>${escapeHtml(formatMoney(order.taxPrice))}</span>
          </div>
          <div style="display:flex;justify-content:space-between;color:#0f172a;font-size:16px;font-weight:800;margin-top:10px;">
            <span>Total</span><span>${escapeHtml(formatMoney(order.totalPrice))}</span>
          </div>
        </div>

        <div style="margin-top:20px;color:#64748b;font-size:12px;line-height:1.5;">
          If you didn’t place this order, please contact support immediately.
        </div>
      </div>
    </div>
    <div style="max-width:720px;margin:10px auto 0;color:#94a3b8;font-size:11px;text-align:center;">
      This is an automated message from ${escapeHtml(appName)}.
    </div>
  </div>
  `
}

const renderOrderText = ({ appName, order, user, isAdmin }) => {
  const idShort = order._id?.toString()?.slice(-8)?.toUpperCase()
  const lines = []
  lines.push(`${appName} - ${isAdmin ? 'New order received' : 'Order confirmation'}`)
  lines.push(`Order: #${idShort}`)
  lines.push(`Status: ${order.orderStatus} | Payment: ${order.isPaid ? 'Paid' : 'Pending'}`)
  if (isAdmin) {
    lines.push(`Customer: ${user?.name || ''} | ${user?.email || ''} | ${user?.phone || ''}`)
  }
  const addr = order.shippingAddress || {}
  lines.push(`Ship to: ${addr.fullName || ''}, ${addr.addressLine1 || ''} ${addr.addressLine2 || ''}, ${addr.city || ''}, ${addr.state || ''} ${addr.pincode || ''}, ${addr.country || 'India'}`)
  lines.push(`Phone: ${addr.phone || user?.phone || ''}`)
  lines.push('Items:')
  for (const item of (order.orderItems || [])) {
    lines.push(`- ${item.name} x${item.quantity} @ ${formatMoney(item.price)} = ${formatMoney((Number(item.price) || 0) * (Number(item.quantity) || 0))}`)
  }
  lines.push(`Items: ${formatMoney(order.itemsPrice)} | Shipping: ${formatMoney(order.shippingPrice)} | Tax: ${formatMoney(order.taxPrice)} | Total: ${formatMoney(order.totalPrice)}`)
  return lines.join('\n')
}

export const sendOrderEmails = async ({ order, user }) => {
  console.log("Order email triggered");
  const cfg = getMailConfig()
  if (!isMailConfigured(cfg)) return { skipped: true }
  const transporter = createTransporter(cfg)

  const orderIdShort = order._id?.toString()?.slice(-8)?.toUpperCase()
  const subjectUser = `${cfg.appName}: Order confirmed (#${orderIdShort})`
  const subjectAdmin = `${cfg.appName}: New order (#${orderIdShort})`

  const htmlUser = renderOrderHtml({ appName: cfg.appName, order, user, isAdmin: false })
  const htmlAdmin = renderOrderHtml({ appName: cfg.appName, order, user, isAdmin: true })
  const textUser = renderOrderText({ appName: cfg.appName, order, user, isAdmin: false })
  const textAdmin = renderOrderText({ appName: cfg.appName, order, user, isAdmin: true })

  const results = { user: null, admin: null }

  if (user?.email) {
    try {
      results.user = await transporter.sendMail({
        from: cfg.from,
        to: user.email,
        subject: subjectUser,
        text: textUser,
        html: htmlUser,
      })
      console.log("Customer email sent");
    } catch (error) {
      console.error("Email error:", error);
    }
  }

  const adminRecipient = (!cfg.adminEmail || cfg.adminEmail.endsWith('@Maranatha.com')) ? cfg.user : cfg.adminEmail

  if (adminRecipient) {
    try {
      results.admin = await transporter.sendMail({
        from: cfg.from,
        to: adminRecipient,
        subject: subjectAdmin,
        text: textAdmin,
        html: htmlAdmin,
      })
      console.log("Admin email sent");
    } catch (error) {
      console.error("Email error:", error);
    }
  }

  return results
}

const renderCancelHtml = ({ appName, order, user, reason, isAdmin }) => {
  const orderIdShort = order._id?.toString()?.slice(-8)?.toUpperCase()
  const placedOn = order.createdAt ? new Date(order.createdAt).toLocaleString('en-IN') : ''
  const cancelledOn = new Date().toLocaleString('en-IN')
  const addr = order.shippingAddress || {}

  const customerBlock = isAdmin ? `
    <h3 style="margin:24px 0 8px;color:#0f172a;">Customer</h3>
    <div style="color:#334155;font-size:14px;line-height:1.5">
      <div><strong>Name:</strong> ${escapeHtml(user?.name || '')}</div>
      <div><strong>Email:</strong> ${escapeHtml(user?.email || '')}</div>
      <div><strong>Phone:</strong> ${escapeHtml(user?.phone || '')}</div>
    </div>
  ` : ''

  return `
  <div style="background:#f8fafc;padding:24px 0;">
    <div style="max-width:720px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
      <div style="padding:20px 24px;background:linear-gradient(135deg,#ef4444,#b91c1c);color:#fff;">
        <div style="font-size:18px;font-weight:800;letter-spacing:.2px;">${escapeHtml(appName)}</div>
        <div style="margin-top:8px;font-size:14px;opacity:.95;">
          ${isAdmin ? 'Order cancelled' : 'Your order has been cancelled'}
        </div>
      </div>

      <div style="padding:22px 24px;">
        <div style="display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;">
          <div>
            <div style="color:#64748b;font-size:12px;letter-spacing:.12em;text-transform:uppercase;">Order</div>
            <div style="font-weight:800;color:#0f172a;font-size:18px;margin-top:4px;">#${escapeHtml(orderIdShort)}</div>
            <div style="color:#64748b;font-size:12px;margin-top:6px;">Placed: ${escapeHtml(placedOn)}</div>
          </div>
          <div style="text-align:right;">
            <div style="color:#64748b;font-size:12px;letter-spacing:.12em;text-transform:uppercase;">Cancelled</div>
            <div style="font-weight:700;color:#0f172a;font-size:14px;margin-top:4px;">${escapeHtml(cancelledOn)}</div>
            <div style="color:#64748b;font-size:12px;margin-top:6px;">Status: cancelled</div>
          </div>
        </div>

        ${customerBlock}

        <h3 style="margin:24px 0 8px;color:#0f172a;">Cancellation reason</h3>
        <div style="background:#f1f5f9;border:1px solid #e2e8f0;border-radius:12px;padding:12px;color:#0f172a;font-size:14px;">
          ${escapeHtml(reason || '')}
        </div>

        <h3 style="margin:24px 0 8px;color:#0f172a;">Shipping address</h3>
        <div style="color:#334155;font-size:14px;line-height:1.5">
          <div style="font-weight:700">${escapeHtml(addr.fullName || '')}</div>
          <div>${escapeHtml(addr.addressLine1 || '')}${addr.addressLine2 ? `, ${escapeHtml(addr.addressLine2)}` : ''}</div>
          <div>${escapeHtml(addr.city || '')}, ${escapeHtml(addr.state || '')} ${escapeHtml(addr.pincode || '')}</div>
          <div>${escapeHtml(addr.country || 'India')}</div>
        </div>

        <div style="margin-top:18px;color:#64748b;font-size:12px;line-height:1.5;">
          If you need help, reply to this email or contact support.
        </div>
      </div>
    </div>
    <div style="max-width:720px;margin:10px auto 0;color:#94a3b8;font-size:11px;text-align:center;">
      This is an automated message from ${escapeHtml(appName)}.
    </div>
  </div>
  `
}

export const sendOrderCancelledEmails = async ({ order, user, reason }) => {
  console.log("Cancel email triggered");
  const cfg = getMailConfig()
  if (!isMailConfigured(cfg)) return { skipped: true }
  const transporter = createTransporter(cfg)

  const orderIdShort = order._id?.toString()?.slice(-8)?.toUpperCase()
  const subjectUser = `${cfg.appName}: Order cancelled (#${orderIdShort})`
  const subjectAdmin = `${cfg.appName}: Order cancelled (#${orderIdShort})`

  const htmlUser = renderCancelHtml({ appName: cfg.appName, order, user, reason, isAdmin: false })
  const htmlAdmin = renderCancelHtml({ appName: cfg.appName, order, user, reason, isAdmin: true })
  const textUser = `${cfg.appName}\nOrder #${orderIdShort} cancelled.\nReason: ${reason || ''}`
  const textAdmin = `${cfg.appName}\nOrder #${orderIdShort} cancelled.\nCustomer: ${user?.name || ''} (${user?.email || ''})\nReason: ${reason || ''}`

  const results = { user: null, admin: null }

  if (user?.email) {
    try {
      results.user = await transporter.sendMail({
        from: cfg.from,
        to: user.email,
        subject: subjectUser,
        text: textUser,
        html: htmlUser,
      })
      console.log("Customer email sent");
    } catch (error) {
      console.error("Email error:", error);
    }
  }

  const adminRecipient = (!cfg.adminEmail || cfg.adminEmail.endsWith('@Maranatha.com')) ? cfg.user : cfg.adminEmail

  if (adminRecipient) {
    try {
      results.admin = await transporter.sendMail({
        from: cfg.from,
        to: adminRecipient,
        subject: subjectAdmin,
        text: textAdmin,
        html: htmlAdmin,
      })
      console.log("Admin email sent");
    } catch (error) {
      console.error("Email error:", error);
    }
  }

  return results
}
