/** Ready WhatsApp / SMS templates for tuition centres. */

const MESSAGE_TEMPLATES = [
  {
    id: 'fee_due',
    name: 'Fee due reminder',
    category: 'fees',
    body: 'Hi {{parentName}}, fee of ₹{{amount}} for {{studentName}} ({{month}}/{{year}}) is due. Please pay at your earliest. — {{centreName}}',
  },
  {
    id: 'fee_received',
    name: 'Fee received',
    category: 'fees',
    body: 'Hi {{parentName}}, we received ₹{{amount}} for {{studentName}} ({{month}}/{{year}}). Thank you! — {{centreName}}',
  },
  {
    id: 'absent',
    name: 'Absent today',
    category: 'attendance',
    body: 'Hi {{parentName}}, {{studentName}} was marked absent today ({{date}}). Please confirm. — {{centreName}}',
  },
  {
    id: 'demo_reminder',
    name: 'Demo / trial reminder',
    category: 'leads',
    body: 'Hi {{parentName}}, reminder for {{studentName}}’s demo class on {{date}}. See you soon! — {{centreName}}',
  },
  {
    id: 'homework',
    name: 'Homework reminder',
    category: 'academics',
    body: 'Hi {{parentName}}, homework for {{studentName}} is due on {{date}}. Please ensure it is completed. — {{centreName}}',
  },
  {
    id: 'holiday',
    name: 'Holiday notice',
    category: 'ops',
    body: 'Hi {{parentName}}, {{centreName}} will be closed on {{date}}. Classes resume next working day. Thank you.',
  },
  {
    id: 'custom',
    name: 'Custom message',
    category: 'custom',
    body: '',
  },
];

function getTemplate(id) {
  return MESSAGE_TEMPLATES.find((t) => t.id === id) || null;
}

function fillTemplate(body, vars = {}) {
  return String(body || '').replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const v = vars[key];
    return v == null || v === '' ? `{{${key}}}` : String(v);
  });
}

module.exports = { MESSAGE_TEMPLATES, getTemplate, fillTemplate };
