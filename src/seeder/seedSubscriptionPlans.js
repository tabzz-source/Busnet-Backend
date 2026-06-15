const mongoose = require('mongoose');
const dotenv = require('dotenv');
const SubscriptionPlan = require('../models/SubscriptionPlan');

dotenv.config();

const MOCK_PLANS = [
  {
    planName: 'Basic Coach',
    code: 'BASIC',
    description: 'Perfect for local bus operators starting to manage their routes and trips digitally.',
    price: 500000,
    durationDays: 30,
    discount: 0,
    planFeatures: [
      'Manage up to 5 buses',
      'Create up to 3 routes',
      'Basic Route & Trip Scheduling',
      'Standard 24/7 Support'
    ],
    maxBuses: 5,
    maxRoutes: 3,
    isPopular: false,
    status: 'ACTIVE',
    chartColor: '#0185FF'
  },
  {
    planName: 'Professional Fleet',
    code: 'PRO',
    description: 'Designed for growing transit operators seeking wider coverage, detailed reports, and larger fleets.',
    price: 1200000,
    durationDays: 30,
    discount: 0,
    planFeatures: [
      'Manage up to 20 buses',
      'Create up to 15 routes',
      'Advanced scheduling & custom timings',
      'Priority 24/7 technical support',
      'Basic sales dashboard & analytics',
      'Featured operator highlight badge'
    ],
    maxBuses: 20,
    maxRoutes: 15,
    isPopular: true,
    status: 'ACTIVE',
    chartColor: '#FF8A00'
  }
];

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB successfully.');

    console.log('ℹ Cleaning old subscription plans in subscription_plans...');
    await SubscriptionPlan.deleteMany({});
    console.log('✅ Cleaned old plans.');

    let insertedCount = 0;
    for (const plan of MOCK_PLANS) {
      await SubscriptionPlan.create(plan);
      insertedCount++;
      console.log(`+ Seeded subscription plan: "${plan.planName}"`);
    }

    console.log(`\n🎉 Seeding complete! Added ${insertedCount} subscription plans.`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    process.exit(1);
  }
};

seed();
