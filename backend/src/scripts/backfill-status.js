// One-off migration: give every pre-existing opportunity a `status`.
//
// Run once after deploying the lifecycle change:
//   npm run backfill:status
//
// A Mongoose `default` only applies to documents created after it was declared,
// so opportunities written before `status` existed have no such field. They
// would then be invisible to a `{ status: 'open' }` query — every existing
// listing would vanish from the home page.
//
// The alternative is teaching every query to accept `{ $in: ['open', null] }`,
// which is how legacy `Pending` applications are handled in
// applicationController.js. That works, but it spreads one historical accident
// across every read path forever. A single explicit backfill is cheaper to
// understand and to delete later.
require('dotenv').config();

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Opportunity = require('../models/Opportunity');
const { OPPORTUNITY_PUBLIC_STATUS } = require('../config/constants');

async function backfillStatus() {
  await connectDB();

  // Both branches: field absent entirely, or present but null/''.
  const result = await Opportunity.updateMany(
    { $or: [{ status: { $exists: false } }, { status: null }, { status: '' }] },
    { $set: { status: OPPORTUNITY_PUBLIC_STATUS } }
  );

  console.log(
    `✅ Backfilled status='${OPPORTUNITY_PUBLIC_STATUS}' on ${result.modifiedCount} opportunit${
      result.modifiedCount === 1 ? 'y' : 'ies'
    }.`
  );

  if (result.modifiedCount === 0) {
    console.log('   Nothing to do — every opportunity already has a status.');
  }
}

backfillStatus()
  .then(async () => {
    await mongoose.connection.close();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('❌ Backfill failed:', err.message);
    await mongoose.connection.close().catch(() => {});
    process.exit(1);
  });
