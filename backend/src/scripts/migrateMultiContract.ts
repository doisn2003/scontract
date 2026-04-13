/**
 * migrateMultiContract.ts
 * Migration script to convert existing single-contract projects to the new multi-contract structure.
 * 
 * Usage: npx ts-node backend/src/scripts/migrateMultiContract.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import Project from '../models/Project.js';

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function migrate() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/scontract';
  console.log('Connecting to MongoDB...');
  await mongoose.connect(uri);

  const projects = await Project.find({
    $or: [
      { contracts: { $exists: false } },
      { contracts: { $size: 0 } }
    ]
  });

  console.log(`Found ${projects.length} projects to migrate...`);

  for (const project of projects) {
    const projAny = project as any;
    
    // Skip if all relevant fields are empty
    if (!projAny.soliditySource && !projAny.contractName && !projAny.abi) {
      console.log(`Skipping empty project ${project._id} (${project.name})`);
      continue;
    }

    const legacyContract = {
      name: projAny.contractName || project.name || 'Untitled Contract',
      soliditySource: projAny.soliditySource || '',
      abi: projAny.abi,
      bytecode: projAny.bytecode,
      contractAddress: projAny.contractAddress,
      isDeployed: !!projAny.contractAddress,
      deployedAt: projAny.contractAddress ? new Date() : undefined,
      createdAt: project.createdAt || new Date(),
      updatedAt: project.updatedAt || new Date(),
    };

    project.contracts.push(legacyContract as any);
    
    // Clear legacy fields if desired, or keep them for safety
    // For now, we'll keep them but mark the project as migrated
    await project.save();
    console.log(`Migrated project ${project._id} (${project.name}) -> 1 Contract: ${legacyContract.name}`);
  }

  console.log('Migration complete!');
  await mongoose.disconnect();
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
