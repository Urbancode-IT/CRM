function receiptEmail({ studentName, amount, month, year, paidDate, method }) {
  const monthName = new Date(year, month - 1, 1).toLocaleString('default', { month: 'long' });
  return {
    subject: `Payment Received - ${monthName} ${year}`,
    html: `
      <p>Dear ${studentName},</p>
      <p>We confirm receipt of your tuition fee payment:</p>
      <ul>
        <li><strong>Amount:</strong> ${amount}</li>
        <li><strong>Billing period:</strong> ${monthName} ${year}</li>
        <li><strong>Paid on:</strong> ${new Date(paidDate).toLocaleDateString()}</li>
        <li><strong>Method:</strong> ${method}</li>
      </ul>
      <p>Thank you for your payment.</p>
      <p>— Tuition CRM</p>
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
        <li><strong>Amount due:</strong> ${amount}</li>
        <li><strong>Due date:</strong> ${new Date(dueDate).toLocaleDateString()}</li>
      </ul>
      <p>Please arrange payment at your earliest convenience. If you have already paid, kindly disregard this message.</p>
      <p>— Tuition CRM</p>
    `,
  };
}

module.exports = { receiptEmail, overdueReminderEmail };
