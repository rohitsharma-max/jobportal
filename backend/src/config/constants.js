// Shared constants used across models, controllers, and validation.

// Fixed domain list. Using a fixed set (not free text) keeps filtering consistent
// and prevents casing bugs like "web development" vs "Web Development".
const DOMAINS = [
  'Web Development',
  'Mobile Development',
  'Data Science',
  'Machine Learning',
  'UI/UX Design',
  'DevOps',
  'Cybersecurity',
  'Marketing',
  'Finance',
  'Human Resources',
  'Content Writing',
];

const OPPORTUNITY_TYPES = ['Internship', 'Job'];

module.exports = { DOMAINS, OPPORTUNITY_TYPES };
