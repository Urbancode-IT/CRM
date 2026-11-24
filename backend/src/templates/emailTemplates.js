function brandFooter() {
  return `<p style="color:#64748b;font-size:12px;margin-top:24px">— Tusion</p>`;
}

function receiptEmail({ studentName, amount, month, year, paidDate, method }) {
  const monthName = new Date(year, month - 1, 1).toLocaleString('default', { month: 'long' });
  return {
    subject: `Payment Received - ${monthName} ${year}`,
    html: `
      <p>Dear ${studentName},</p>
      <p>We confirm receipt of your tuition fee payment:</p>
      <ul>
        <li><strong>Amount:</strong> ₹${amount}</li>
        <li><strong>Billing period:</strong> ${monthName} ${year}</li>
        <li><strong>Paid on:</strong> ${new Date(paidDate).toLocaleDateString()}</li>
        <li><strong>Method:</strong> ${method}</li>
      </ul>
      <p>Thank you for your payment.</p>
      ${brandFooter()}
    `,
  };
}

function overdueReminderEmail({ studentName, amount, month, year, dueDate }) {
  const monthName = new Date(year, month - 1, 1).toLocaleString('default', { month: 'long' });
  return {
    subject: `Payment Reminder - ${monthName} ${year} fee overdue`,
    html: `
      <p>Dear ${studentName},</p>
      <p>This is a reminder that the tuition fee for <strong>${monthName} ${year}</strong> is now overdue.</p>
      <ul>
        <li><strong>Amount due:</strong> ₹${amount}</li>
        <li><strong>Due date:</strong> ${new Date(dueDate).toLocaleDateString()}</li>
      </ul>
      <p>Please arrange payment at your earliest convenience.</p>
      ${brandFooter()}
    `,
  };
}

function inviteEmail({ inviterName, workspaceName, role, acceptUrl }) {
  return {
    subject: `You're invited to ${workspaceName} on Tusion`,
    html: `
      <p>Hi,</p>
      <p><strong>${inviterName || 'A teammate'}</strong> invited you to join
      <strong>${workspaceName}</strong> as <strong>${role}</strong>.</p>
      <p><a href="${acceptUrl}" style="display:inline-block;background:#2549d1;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Accept invite</a></p>
      <p style="font-size:12px;color:#64748b">Or open: ${acceptUrl}</p>
      ${brandFooter()}
    `,
  };
}

function workflowNotifyEmail({ title, message, workspaceName }) {
  return {
    subject: title || `Update from ${workspaceName || 'Tusion'}`,
    html: `
      <p><strong>${title || 'Workflow notification'}</strong></p>
      <p>${message || ''}</p>
      ${brandFooter()}
    `,
  };
}

function otpEmail({ code, purpose }) {
  return {
    subject: 'Your Tusion verification code',
    html: `
      <p>Your one-time code for ${purpose || 'sign-in'} is:</p>
      <p style="font-size:28px;letter-spacing:4px;font-weight:700">${code}</p>
      <p>This code expires in 10 minutes.</p>
      ${brandFooter()}
    `,
  };
}

function parentMagicEmail({ studentName, loginUrl, code }) {
  return {
    subject: `Parent access for ${studentName}`,
    html: `
      <p>Use this link to view fees and attendance for <strong>${studentName}</strong>:</p>
      <p><a href="${loginUrl}">${loginUrl}</a></p>
      <p>Or enter code: <strong>${code}</strong></p>
      ${brandFooter()}
    `,
  };
}

module.exports = {
  receiptEmail,
  overdueReminderEmail,
  inviteEmail,
  workflowNotifyEmail,
  otpEmail,
  parentMagicEmail,
};
