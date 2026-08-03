// Seeds the database with sample opportunities for development/demo.
// Run with:  npm run seed   (clears opportunities + applications first)
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const Opportunity = require('./models/Opportunity');
const Application = require('./models/Application');
const User = require('./models/User');
const RefreshToken = require('./models/RefreshToken');

const sampleOpportunities = [
  {
    title: 'Frontend Developer Intern',
    company: 'Acme Corp',
    domain: 'Web Development',
    type: 'Internship',
    location: 'Remote',
    experience: 'Fresher',
    description:
      'Join our web team to build responsive user interfaces with React. You will work on real product features, learn modern tooling, and collaborate with designers.',
    stipendOrSalary: 'INR 15,000/month',
    applicationLink: '',
    requirements: ['React', 'JavaScript', 'CSS'],
  },
  {
    title: 'Backend Developer',
    company: 'CloudNine Technologies',
    domain: 'Web Development',
    type: 'Job',
    location: 'Bangalore',
    experience: '1-2 years',
    description:
      'Design and build scalable REST APIs with Node.js and Express. Work with MongoDB, write clean code, and ship features to production.',
    stipendOrSalary: '8 LPA',
    requirements: ['Node.js', 'Express', 'MongoDB'],
  },
  {
    title: 'Data Science Intern',
    company: 'InsightLabs',
    domain: 'Data Science',
    type: 'Internship',
    location: 'Hyderabad',
    experience: 'Fresher',
    description:
      'Analyze datasets, build dashboards, and support the data team with cleaning and visualization tasks. Great learning opportunity for aspiring data scientists.',
    stipendOrSalary: 'INR 20,000/month',
    requirements: ['Python', 'Pandas', 'SQL'],
  },
  {
    title: 'Machine Learning Engineer',
    company: 'NeuralWorks',
    domain: 'Machine Learning',
    type: 'Job',
    location: 'Remote',
    experience: '2+ years',
    description:
      'Build and deploy ML models for production. Experience with model training, evaluation, and MLOps pipelines preferred.',
    stipendOrSalary: '14 LPA',
    requirements: ['Python', 'TensorFlow', 'MLOps'],
  },
  {
    title: 'UI/UX Design Intern',
    company: 'PixelPerfect Studio',
    domain: 'UI/UX Design',
    type: 'Internship',
    location: 'Pune',
    experience: 'Fresher',
    description:
      'Craft wireframes, prototypes, and design systems in Figma. Collaborate closely with developers to bring designs to life.',
    stipendOrSalary: 'INR 12,000/month',
    requirements: ['Figma', 'Wireframing', 'Prototyping'],
  },
  {
    title: 'DevOps Engineer',
    company: 'ScaleOps',
    domain: 'DevOps',
    type: 'Job',
    location: 'Remote',
    experience: '3+ years',
    description:
      'Own CI/CD pipelines, container orchestration, and cloud infrastructure. Automate everything and keep systems reliable.',
    stipendOrSalary: '18 LPA',
    requirements: ['Docker', 'Kubernetes', 'AWS', 'CI/CD'],
  },
];

async function seed() {
  try {
    await connectDB();
    await Opportunity.deleteMany({});
    await Application.deleteMany({});
    // Sessions reference users that this script is about to replace, so any
    // token left over from a previous seed would point at a deleted account.
    await RefreshToken.deleteMany({});
    // `status` is omitted from the samples above and supplied by the schema
    // default ('open'), which insertMany applies.
    const created = await Opportunity.insertMany(sampleOpportunities);
    console.log(
      `🌱 Seeded ${created.length} opportunities. Cleared applications and sessions.`
    );

    // Create (or reset) the default admin account.
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@portal.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    await User.deleteOne({ email: adminEmail });
    await User.create({
      name: 'Admin',
      email: adminEmail,
      password: adminPassword, // hashed by the model's pre-save hook
      role: 'admin',
    });
    console.log(`👤 Admin ready → ${adminEmail} / ${adminPassword}`);

    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  }
}

seed();
