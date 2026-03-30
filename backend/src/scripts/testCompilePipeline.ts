/**
 * testCompilePipeline.ts
 * End-to-end test for Phase 4: Create → Compile → verify ABI/Bytecode in DB.
 *
 * Usage: node --loader ts-node/esm src/scripts/testCompilePipeline.ts
 *
 * Prerequisites:
 *   1. Backend running (npm run dev)
 *   2. Docker running + scontract-hardhat-base image built
 *   3. A user account exists in the system
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Wallet from '../models/Wallet.js';
import Project from '../models/Project.js';
import * as projectService from '../services/projectService.js';

const SIMPLE_STORAGE_SOL = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract SimpleStorage {
    uint256 private storedValue;

    event ValueChanged(uint256 newValue);

    function store(uint256 value) public {
        storedValue = value;
        emit ValueChanged(value);
    }

    function retrieve() public view returns (uint256) {
        return storedValue;
    }
}
`.trim();

async function main() {
  const dbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/scontract';
  console.log('📡 Connecting to:', dbUri);
  await mongoose.connect(dbUri);

  try {
    // ─── Step 1: Get first user ───
    const user = await User.findOne().lean();
    if (!user) {
      console.error('❌ No user found. Please register first via the frontend.');
      process.exit(1);
    }
    console.log(`👤 Using user: ${user.email} (${user._id})`);

    // ─── Step 2: Get first wallet ───
    const wallet = await Wallet.findOne({ userId: user._id }).lean();
    if (!wallet) {
      console.error('❌ No wallet found. Please create a wallet first.');
      process.exit(1);
    }
    console.log(`💼 Using wallet: ${wallet.address} (${wallet._id})`);

    // ─── Step 3: Create project ───
    console.log('\n' + '='.repeat(60));
    console.log('TEST 1: Create Project');
    console.log('='.repeat(60));
    const project = await projectService.createProject(
      user._id.toString(),
      wallet._id.toString(),
      'Test SimpleStorage',
      'Phase 4 integration test',
      SIMPLE_STORAGE_SOL
    );
    console.log(`✅ Created project: ${project._id}`);
    console.log(`   Name: ${project.name}`);
    console.log(`   Status: ${project.status}`);
    console.log(`   Solidity: ${project.solidityVersion}`);

    // ─── Step 4: Compile ───
    console.log('\n' + '='.repeat(60));
    console.log('TEST 2: Compile Project (Docker sandbox)');
    console.log('='.repeat(60));
    console.log('⏳ Starting compilation... (may take 10-30s)');
    const compileResult = await projectService.compileProject(
      project._id.toString(),
      user._id.toString()
    );
    console.log(`✅ Compilation result:`);
    console.log(`   Status: ${compileResult.status}`);
    console.log(`   ABI entries: ${compileResult.abi?.length ?? 0}`);
    console.log(`   Bytecode: ${compileResult.bytecode?.substring(0, 20)}...`);

    // ─── Step 5: Verify DB ───
    console.log('\n' + '='.repeat(60));
    console.log('TEST 3: Verify in database');
    console.log('='.repeat(60));
    const dbProject = await Project.findById(project._id).lean();
    if (!dbProject) {
      console.error('❌ Project not found in DB!');
      process.exit(1);
    }
    const checks = {
      'status=compiled': dbProject.status === 'compiled',
      'abi present': Array.isArray(dbProject.abi) && dbProject.abi.length > 0,
      'bytecode present': typeof dbProject.bytecode === 'string' && dbProject.bytecode.length > 0,
      'version set': typeof dbProject.solidityVersion === 'string',
    };

    for (const [name, pass] of Object.entries(checks)) {
      console.log(`   ${pass ? '✅' : '❌'} ${name}`);
    }

    const allPass = Object.values(checks).every(Boolean);
    console.log(`\n${'='.repeat(60)}`);
    console.log(allPass ? '🎉 ALL TESTS PASSED' : '❌ SOME TESTS FAILED');
    console.log('='.repeat(60));

    // Cleanup: remove test project
    await Project.findByIdAndDelete(project._id);
    console.log('🗑️  Test project cleaned up.');

  } finally {
    await mongoose.disconnect();
    console.log('📡 Disconnected from DB.');
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
