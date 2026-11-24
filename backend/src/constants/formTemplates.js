function field(name, type, required = false, options = [], placeholder = '') {
  return {
    name,
    key: name.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
    type,
    required,
    options,
    placeholder,
    order: 0,
  };
}

function withOrder(fields) {
  return fields.map((f, i) => ({ ...f, order: i }));
}

/** Built-in form templates available to every workspace. */
const BUILT_IN_FORM_TEMPLATES = [
  {
    id: 'blank',
    name: 'Blank form',
    description: 'Start empty — add your own fields',
    category: 'general',
    fields: [],
  },
  {
    id: 'student_admission',
    name: 'Student admission',
    description: 'Enroll a student with parent contact, batch, and fee',
    category: 'students',
    fields: withOrder([
      field('Student name', 'text', true),
      field('Parent name', 'text', true),
      field('Phone', 'phone', true),
      field('Email', 'email', false),
      field('Grade / level', 'text', false),
      field('Preferred batch', 'dropdown', false, ['Batch A', 'Batch B', 'Batch C']),
      field('Subjects', 'text', false),
      field('Monthly fee', 'number', false),
      field('Join date', 'date', false),
      field('Notes', 'textarea', false),
    ]),
  },
  {
    id: 'class_enquiry',
    name: 'Class enquiry',
    description: 'Lead / demo class request from parents',
    category: 'leads',
    fields: withOrder([
      field('Name', 'text', true),
      field('Phone', 'phone', true),
      field('Email', 'email', false),
      field('Interested in', 'dropdown', true, [
        'Tuition',
        'Swimming',
        'Dance',
        'Music',
        'Sports',
        'Other',
      ]),
      field('Preferred time', 'text', false),
      field('Message', 'textarea', false),
    ]),
  },
  {
    id: 'parent_feedback',
    name: 'Parent feedback',
    description: 'Collect ratings and comments from parents',
    category: 'feedback',
    fields: withOrder([
      field('Parent name', 'text', true),
      field('Student name', 'text', true),
      field('Rating', 'dropdown', true, ['1', '2', '3', '4', '5']),
      field('What went well', 'textarea', false),
      field('Comments', 'textarea', false),
    ]),
  },
  {
    id: 'leave_request',
    name: 'Leave request',
    description: 'Student leave / absence request',
    category: 'attendance',
    fields: withOrder([
      field('Student name', 'text', true),
      field('Parent phone', 'phone', true),
      field('From date', 'date', true),
      field('To date', 'date', true),
      field('Reason', 'textarea', true),
    ]),
  },
  {
    id: 'fee_receipt_request',
    name: 'Fee receipt request',
    description: 'Parent asks for fee receipt / invoice',
    category: 'payments',
    fields: withOrder([
      field('Student name', 'text', true),
      field('Parent name', 'text', true),
      field('Phone', 'phone', true),
      field('Month', 'dropdown', true, [
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
        'November',
        'December',
      ]),
      field('Year', 'number', true),
      field('Notes', 'textarea', false),
    ]),
  },
  {
    id: 'instructor_application',
    name: 'Instructor application',
    description: 'Hire coaches / teachers',
    category: 'instructors',
    fields: withOrder([
      field('Full name', 'text', true),
      field('Phone', 'phone', true),
      field('Email', 'email', true),
      field('Specialties', 'text', true),
      field('Years of experience', 'number', false),
      field('Available days', 'text', false),
      field('Expected monthly pay', 'number', false),
      field('About you', 'textarea', false),
    ]),
  },
  {
    id: 'event_registration',
    name: 'Event / demo registration',
    description: 'Register for open day, demo, or competition',
    category: 'events',
    fields: withOrder([
      field('Participant name', 'text', true),
      field('Parent phone', 'phone', true),
      field('Age / grade', 'text', false),
      field('Event', 'dropdown', true, ['Open day', 'Demo class', 'Competition', 'Workshop']),
      field('Notes', 'textarea', false),
    ]),
  },
];

function getBuiltInTemplate(id) {
  return BUILT_IN_FORM_TEMPLATES.find((t) => t.id === id) || null;
}

module.exports = {
  BUILT_IN_FORM_TEMPLATES,
  getBuiltInTemplate,
};
