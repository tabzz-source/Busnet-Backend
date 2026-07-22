const mongoose = require('mongoose');
const dotenv = require('dotenv');
const SubscriptionHistory = require('../models/SubscriptionHistory');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const PartnerSubscription = require('../models/PartnerSubscription');
const PartnerInformation = require('../models/PartnerInformation');
const Account = require('../models/Account');

dotenv.config();

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

    const basicPlan = plans.find((p) => p.code === 'BASIC') || plans[0];
    const proPlan = plans.find((p) => p.code === 'PRO') || plans[plans.length - 1];

    // Find all partner accounts
    const partnerAccounts = await Account.find({ role: 'PARTNER' }).lean();
    console.log(`ℹ Found ${partnerAccounts.length} partner accounts.`);

    if (partnerAccounts.length === 0) {
      console.error('❌ No partner accounts found in DB.');
      process.exit(1);
    }

    const now = new Date();

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

    let totalInserted = 0;

    for (const partner of partnerAccounts) {
      const partnerId = partner._id;

      // Clean old subscription histories for this partner
      await SubscriptionHistory.deleteMany({ partnerId });

      const mockHistories = [
        {
          partnerId,
          planId: basicPlan._id,
          transactionId: new mongoose.Types.ObjectId(),
          subscriptionDate: daysAgo(180),
          expirationDate: daysAgo(150),
          subscriptionStatus: 'EXPIRED'
        },
        {
          partnerId,
          planId: basicPlan._id,
          transactionId: new mongoose.Types.ObjectId(),
          subscriptionDate: daysAgo(150),
          expirationDate: daysAgo(120),
          subscriptionStatus: 'EXPIRED'
        },
        {
          partnerId,
          planId: proPlan._id,
          transactionId: new mongoose.Types.ObjectId(),
          subscriptionDate: daysAgo(120),
          expirationDate: daysAgo(90),
          subscriptionStatus: 'EXPIRED'
        },
        {
          partnerId,
          planId: proPlan._id,
          transactionId: new mongoose.Types.ObjectId(),
          subscriptionDate: daysAgo(80),
          expirationDate: daysAgo(50),
          subscriptionStatus: 'CANCELLED'
        },
        {
          partnerId,
          planId: proPlan._id,
          transactionId: new mongoose.Types.ObjectId(),
          subscriptionDate: daysAgo(10),
          expirationDate: daysFromNow(20),
          subscriptionStatus: 'ACTIVE'
        }
      ];

      for (const history of mockHistories) {
        await SubscriptionHistory.create(history);
        totalInserted++;
      }

      // Sync active PartnerSubscription
      const activeSub = mockHistories.find(h => h.subscriptionStatus === 'ACTIVE');
      if (activeSub) {
        await PartnerSubscription.findOneAndUpdate(
          { partnerId },
          {
            partnerId,
            planId: activeSub.planId,
            subscriptionDate: activeSub.subscriptionDate,
            expirationDate: activeSub.expirationDate,
            subscriptionStatus: 'ACTIVE',
            autoRenew: false
          },
          { upsert: true, returnDocument: 'after' }
        );

        await PartnerInformation.findOneAndUpdate(
          { accountId: partnerId },
          { selectedPlanId: activeSub.planId }
        );
      }

      console.log(`+ Seeded 5 subscription histories for partner [${partner.username || partner.email || partnerId}]`);
    }

    console.log(`\n🎉 Seeding complete! Added ${totalInserted} subscription histories across ${partnerAccounts.length} partners.`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    process.exit(1);
  }
};

seedSubscriptionHistories();
