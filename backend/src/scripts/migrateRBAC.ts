import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import SystemConfig from '../models/SystemConfig.js';
import connectDB from '../config/db.js';

dotenv.config();

const runMigration = async () => {
  try {
    await connectDB();
    console.log('Connected to Database');

    // 1. Migrate old users to 'guest' role if they don't have a role
    // Well, default is 'guest', but let's make sure everyone in DB who isn't explicitly set is 'guest'
    const result = await User.updateMany(
      { role: { $exists: false } },
      { $set: { role: 'guest', status: 'active' } }
    );
    console.log(`Migrated ${result.modifiedCount} users to 'guest' role`);

    // 2. Create the default admin account
    const adminEmail = 'admin@sphoton.com';
    const pwd = 'Sphoton123$';
    
    let admin = await User.findOne({ email: adminEmail });
    if (!admin) {
      console.log('Creating default admin account...');
      
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(pwd, salt);
      
      // using create directly? No wait, mongoose pre-save hook handles hashing!
      // I should just provide plain password when creating via model
      // But if I use insertMany it bypasses. If I use create, it triggers hook.
      admin = await User.create({
        email: adminEmail,
        password: pwd,
        name: 'Super Admin',
        role: 'admin',
        status: 'active'
      });
      console.log('Default admin created successfully.');
    } else {
      console.log('Admin account already exists. Updating role to admin...');
      admin.role = 'admin';
      await admin.save();
    }

    // 3. Seed initial system configurations
    const configs = [
      { key: 'faucet_native_limit', value: '1.0' },
      { key: 'faucet_daily_max', value: '5' }
    ];

    for (const conf of configs) {
      await SystemConfig.findOneAndUpdate(
        { key: conf.key },
        { value: conf.value },
        { upsert: true }
      );
    }
    console.log('System configs seeded successfully.');

  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    process.exit(0);
  }
};

runMigration();
