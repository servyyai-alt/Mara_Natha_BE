import { sendMail } from './sendMail.js'

const fmt = (d) => (d ? new Date(d).toLocaleString('en-IN') : '')

const getMailConfig = () => {
  const host = process.env.SMTP_HOST || ''
  const port = Number(process.env.SMTP_PORT || 587)
  const secure = String(process.env.SMTP_SECURE).toLowerCase() === 'true'
  const user = process.env.SMTP_USER || ''
  const pass = process.env.SMTP_PASS || ''
  const from = process.env.SMTP_FROM || process.env.ADMIN_EMAIL || user
  const adminEmail = process.env.ADMIN_EMAIL || ''
  const appName = process.env.APP_NAME || 'Maranatha'
  return { host, port, secure, user, pass, from, adminEmail, appName }
}

const isMailConfigured = (cfg) =>
  Boolean(cfg.host && cfg.port && cfg.user && cfg.pass && cfg.from)

const subjectForReturnStatus = (status) => {
  const s = String(status || '')
  if (s === 'requested') return 'Return initiated'
  if (s === 'pickup_scheduled') return 'Return pickup scheduled'
  if (s === 'picked_up') return 'Return picked up'
  if (s === 'received') return 'Return received'
  if (s === 'qc_failed') return 'Return QC failed'
  if (s === 'qc_passed') return 'Return QC passed'
  return `Return update: ${s}`
}

// Send return request email to Customer
export const sendReturnRequestEmail = async ({ returnRequest, order, user }) => {
  const to = user?.email
  if (!to) return
  const orderIdShort = order?._id?.toString()?.slice(-8)?.toUpperCase()
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6">
      <h2>Return Request Initiated</h2>
      <p>Dear ${user.name || 'Customer'},</p>
      <p>We have received your return request for Order <strong>#${orderIdShort}</strong>.</p>
      <p><strong>Status:</strong> Return requested</p>
      <p>Our team will process your return shortly.</p>
      <p>Thanks,<br/>Maranatha</p>
    </div>
  `
  try {
    await sendMail({ to, subject: 'Return initiated', html })
    console.log("Customer email sent");
  } catch (error) {
    console.error("Email error:", error);
    throw error;
  }
}

// Send return approved email to Customer
export const sendReturnApprovedEmail = async ({ returnRequest, order, user }) => {
  const to = user?.email
  if (!to) return
  const orderIdShort = order?._id?.toString()?.slice(-8)?.toUpperCase()
  const awb = returnRequest?.shiprocket?.awb
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6">
      <h2>Return Approved</h2>
      <p>Dear ${user.name || 'Customer'},</p>
      <p>Your return request for Order <strong>#${orderIdShort}</strong> has been approved.</p>
      <p><strong>Status:</strong> Return approved / QC Passed</p>
      ${awb ? `<p><strong>AWB (Tracking Number):</strong> ${awb}</p>` : ''}
      <p>Thanks,<br/>Maranatha</p>
    </div>
  `
  try {
    await sendMail({ to, subject: 'Return QC passed', html })
    console.log("Customer email sent");
  } catch (error) {
    console.error("Email error:", error);
    throw error;
  }
}

// Send return rejected email to Customer
export const sendReturnRejectedEmail = async ({ returnRequest, order, user }) => {
  const to = user?.email
  if (!to) return
  const orderIdShort = order?._id?.toString()?.slice(-8)?.toUpperCase()
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6">
      <h2>Return Request Update</h2>
      <p>Dear ${user.name || 'Customer'},</p>
      <p>Your return request for Order <strong>#${orderIdShort}</strong> has been updated.</p>
      <p><strong>Status:</strong> QC Failed / Rejected</p>
      <p>Please contact our support for further details.</p>
      <p>Thanks,<br/>Maranatha</p>
    </div>
  `
  try {
    await sendMail({ to, subject: 'Return QC failed', html })
    console.log("Customer email sent");
  } catch (error) {
    console.error("Email error:", error);
    throw error;
  }
}

// Send return notification email to Admin
export const sendAdminReturnNotification = async ({ returnRequest, order, user }) => {
  const cfg = getMailConfig()
  if (!isMailConfigured(cfg)) return
  const adminRecipient = (!cfg.adminEmail || cfg.adminEmail.endsWith('@Maranatha.com')) ? cfg.user : cfg.adminEmail
  if (!adminRecipient) return

  const orderIdShort = order?._id?.toString()?.slice(-8)?.toUpperCase()
  const status = returnRequest?.status
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6">
      <h2>New Return Request Update</h2>
      <p>Admin Notification,</p>
      <p>A return request status has changed for Order <strong>#${orderIdShort}</strong>.</p>
      <p><strong>Status:</strong> ${status}</p>
      <p><strong>Customer:</strong> ${user?.name || ''} (${user?.email || ''})</p>
      <p><strong>Reason:</strong> ${returnRequest?.reason || ''}</p>
      <p>Updated at: ${fmt(new Date())}</p>
    </div>
  `
  try {
    await sendMail({ to: adminRecipient, subject: `Admin Alert: Return update status ${status}`, html })
    console.log("Admin email sent");
  } catch (error) {
    console.error("Email error:", error);
    throw error;
  }
}

// Main handler for status update notifications (called by returnController)
export const sendReturnStatusEmails = async ({ returnRequest, order, user }) => {
  console.log("Return email triggered");
  const status = returnRequest?.status

  try {
    // 1. Send status update to Customer
    if (status === 'requested') {
      await sendReturnRequestEmail({ returnRequest, order, user })
    } else if (status === 'qc_passed') {
      await sendReturnApprovedEmail({ returnRequest, order, user })
    } else if (status === 'qc_failed') {
      await sendReturnRejectedEmail({ returnRequest, order, user })
    } else {
      // Fallback for general status updates to Customer
      const to = user?.email
      if (to) {
        const orderIdShort = order?._id?.toString()?.slice(-8)?.toUpperCase()
        const awb = returnRequest?.shiprocket?.awb
        const html = `
          <div style="font-family:Arial,sans-serif;line-height:1.6">
            <h2>Return Update</h2>
            <p><strong>Order:</strong> #${orderIdShort}</p>
            <p><strong>Status:</strong> ${status}</p>
            ${awb ? `<p><strong>AWB:</strong> ${awb}</p>` : ''}
            <p><strong>Updated at:</strong> ${fmt(new Date())}</p>
            <p>Thanks,<br/>Maranatha</p>
          </div>
        `
        const subject = status === 'pickup_scheduled' ? 'Return pickup scheduled'
                      : status === 'picked_up' ? 'Return picked up'
                      : status === 'received' ? 'Return received'
                      : `Return update: ${status}`;
        await sendMail({ to, subject, html })
        console.log("Customer email sent");
      }
    }

    // 2. Send notification to Admin
    await sendAdminReturnNotification({ returnRequest, order, user })

  } catch (error) {
    console.error("Email error:", error);
  }
}

const subjectForRefundStatus = (status) => {
  const s = String(status || '')
  if (s === 'processed') return 'Refund processed'
  if (s === 'failed') return 'Refund failed'
  return 'Refund update'
}

export const sendRefundStatusEmails = async ({ returnRequest, order, user }) => {
  console.log("Return email triggered");
  const to = user?.email
  if (!to) return
  const orderIdShort = order?._id?.toString()?.slice(-8)?.toUpperCase()
  const refund = returnRequest?.refund || {}
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6">
      <h2>Refund Update</h2>
      <p><strong>Order:</strong> #${orderIdShort}</p>
      <p><strong>Refund status:</strong> ${refund.status}</p>
      <p><strong>Refund amount:</strong> ₹${((Number(refund.amount) || 0) / 100).toLocaleString('en-IN')}</p>
      ${refund.refundId ? `<p><strong>Refund ID:</strong> ${refund.refundId}</p>` : ''}
      <p>Thanks,<br/>Maranatha</p>
    </div>
  `
  try {
    await sendMail({ to, subject: subjectForRefundStatus(refund.status), html })
    console.log("Customer email sent");
  } catch (error) {
    console.error("Email error:", error);
  }
}
