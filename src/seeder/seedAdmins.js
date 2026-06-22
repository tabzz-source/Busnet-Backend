const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const Admin = require('../models/Admin');

dotenv.config();

const MOCK_ADMINS = [
  {
    username: 'admin',
    email: 'admin@busnet.vn',
    password: 'Admin@123', // Clean plain text password to be hashed
    fullName: 'BusNet Administrator',
    role: 'ADMIN',
    status: 'ACTIVE',
    isEmailVerified: true
  }
];

const seedAdmins = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB successfully.');

    console.log('ℹ Cleaning old admin accounts in admins...');
    await Admin.deleteMany({});
    console.log('✅ Cleaned old admins.');

    let insertedCount = 0;
    for (const adminData of MOCK_ADMINS) {
      const passwordHash = await bcrypt.hash(adminData.password, 10);
      const adminToCreate = {
        username: adminData.username,
        email: adminData.email.toLowerCase(),
        passwordHash,
        fullName: adminData.fullName,
        role: adminData.role,
        status: adminData.status,
        isEmailVerified: adminData.isEmailVerified
      };

      await Admin.create(adminToCreate);
      insertedCount++;
      console.log(`+ Seeded admin user: "${adminData.username}" with email: "${adminData.email}" and password: "${adminData.password}"`);
    }

    console.log(`\n🎉 Seeding complete! Added ${insertedCount} admin users.`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    process.exit(1);
  }
};

seedAdmins();
