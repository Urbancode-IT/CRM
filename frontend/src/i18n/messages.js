export const MESSAGES = {
  'en-US': {
    dashboard: 'Dashboard',
    students: 'Students',
    batches: 'Batches',
    attendance: 'Attendance',
    payments: 'Payments',
    tasks: 'Tasks',
    forms: 'Forms',
    workflows: 'Workflows',
    reports: 'Reports',
    billing: 'Billing',
    account: 'Account',
    signIn: 'Sign in',
    signOut: 'Sign out',
    language: 'Language',
  },
  'ta-IN': {
    dashboard: 'டாஷ்போர்டு',
    students: 'மாணவர்கள்',
    batches: 'பேட்ச்கள்',
    attendance: 'வருகை',
    payments: 'கட்டணம்',
    tasks: 'பணிகள்',
    forms: 'படிவங்கள்',
    workflows: 'பணிஓட்டம்',
    reports: 'அறிக்கைகள்',
    billing: 'பில்லிங்',
    account: 'கணக்கு',
    signIn: 'உள்நுழை',
    signOut: 'வெளியேறு',
    language: 'மொழி',
  },
};

export function t(lang, key) {
  const table = MESSAGES[lang] || MESSAGES['en-US'];
  return table[key] || MESSAGES['en-US'][key] || key;
}
