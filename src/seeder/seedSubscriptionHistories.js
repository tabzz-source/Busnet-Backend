const mongoose = require('mongoose');
const dotenv = require('dotenv');
const SubscriptionHistory = require('../models/SubscriptionHistory');
const SubscriptionPlan = require('../models/SubscriptionPlan');

dotenv.config();

const PARTNER_ACCOUNT_ID = '6a41f364712c182acbcf21c7';

const seedSubscriptionHistories = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB successfully.');

    // Fetch existing subscription plans
    const plans = await SubscriptionPlan.find({ status: 'ACTIVE' }).lean();
    if (plans.length === 0) {
      console.error('❌ No subscription plans found. Please run seedSubscriptionPlans first.');
      process.exit(1);
    }

    const basicPlan = plans.find((p) => p.code === 'BASIC');
    const proPlan = plans.find((p) => p.code === 'PRO');

    if (!basicPlan || !proPlan) {
      console.error('❌ Could not find BASIC or PRO plans. Available plans:', plans.map((p) => p.code).join(', '));
      process.exit(1);
    }

    const now = new Date();

    // Helper to create dates relative to now
    const daysAgo = (days) => {
      const d = new Date(now);
      d.setDate(d.getDate() - days);
      return d;
    };

    const daysFromNow = (days) => {
      const d = new Date(now);
      d.setDate(d.getDate() + days);
      return d;
    };

    const MOCK_HISTORIES = [
      // 1) First subscription — BASIC, expired 5 months ago
      {
        partnerId: new mongoose.Types.ObjectId(PARTNER_ACCOUNT_ID),
        planId: basicPlan._id,
        transactionId: null,
        subscriptionDate: daysAgo(180),
        expirationDate: daysAgo(150),
        subscriptionStatus: 'EXPIRED'
      },
      // 2) Second subscription — BASIC renewed, expired 4 months ago
      {
        partnerId: new mongoose.Types.ObjectId(PARTNER_ACCOUNT_ID),
        planId: basicPlan._id,
        transactionId: null,
        subscriptionDate: daysAgo(150),
        expirationDate: daysAgo(120),
        subscriptionStatus: 'EXPIRED'
      },
      // 3) Upgraded to PRO, expired 2 months ago
      {
        partnerId: new mongoose.Types.ObjectId(PARTNER_ACCOUNT_ID),
        planId: proPlan._id,
        transactionId: null,
        subscriptionDate: daysAgo(120),
        expirationDate: daysAgo(90),
        subscriptionStatus: 'EXPIRED'
      },
      // 4) PRO cancelled after 10 days
      {
        partnerId: new mongoose.Types.ObjectId(PARTNER_ACCOUNT_ID),
        planId: proPlan._id,
        transactionId: null,
        subscriptionDate: daysAgo(80),
        expirationDate: daysAgo(50),
        subscriptionStatus: 'CANCELLED'
      },
      // 5) Current active PRO subscription
      {
        partnerId: new mongoose.Types.ObjectId(PARTNER_ACCOUNT_ID),
        planId: proPlan._id,
        transactionId: null,
        subscriptionDate: daysAgo(10),
        expirationDate: daysFromNow(20),
        subscriptionStatus: 'ACTIVE'
      }
    ];

    console.log(`ℹ Cleaning old subscription histories for partner ${PARTNER_ACCOUNT_ID}...`);
    await SubscriptionHistory.deleteMany({
      partnerId: new mongoose.Types.ObjectId(PARTNER_ACCOUNT_ID)
    });
    console.log('✅ Cleaned old subscription histories for this partner.');

    let insertedCount = 0;
    for (const history of MOCK_HISTORIES) {
      await SubscriptionHistory.create(history);
      insertedCount++;
      const planCode = history.planId.equals(basicPlan._id) ? 'BASIC' : 'PRO';
      console.log(
        `+ Seeded subscription history: [${planCode}] ${history.subscriptionStatus} | ${history.subscriptionDate.toISOString().slice(0, 10)} → ${history.expirationDate.toISOString().slice(0, 10)}`
      );
    }

    console.log(`\n🎉 Seeding complete! Added ${insertedCount} subscription histories for partner "${PARTNER_ACCOUNT_ID}".`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    process.exit(1);
  }
};

seedSubscriptionHistories();
