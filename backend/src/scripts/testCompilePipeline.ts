/**
 * testCompilePipeline.ts
 * End-to-end test cho pipeline đa hợp đồng: Create → Compile → verify ABI/Bytecode in DB.
 *
 * Usage: node --loader ts-node/esm src/scripts/testCompilePipeline.ts
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

    // ─── Step 3: Create project (multi-contract API) ───
    console.log('\n' + '='.repeat(60));
    console.log('TEST 1: Create Project with 1 initial contract');
    console.log('='.repeat(60));
    const project = await projectService.createProject(
      user._id.toString(),
      wallet._id.toString(),
      'Test SimpleStorage',
      'Phase 4 integration test',
      [{ soliditySource: SIMPLE_STORAGE_SOL, name: 'SimpleStorage' }]
    );
    console.log(`✅ Created project: ${project._id}`);
    console.log(`   Name: ${project.name}`);
    console.log(`   Contracts: ${project.contracts.length}`);

    const contract = project.contracts[0];
    const contractId = (contract._id as any).toString();
    console.log(`   Contract[0] ID: ${contractId}`);
    console.log(`   Contract[0] Status: ${contract.status}`);

    // ─── Step 4: Compile ───
    console.log('\n' + '='.repeat(60));
    console.log('TEST 2: Compile Contract (Docker sandbox)');
    console.log('='.repeat(60));
    console.log('⏳ Starting compilation... (may take 10-30s)');
    const compileResult = await projectService.compileContract_(
      project._id.toString(),
      user._id.toString(),
      contractId
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
    const dbContract = dbProject.contracts.find((c: any) => c._id.toString() === contractId);
    const checks = {
      'contracts array exists': Array.isArray(dbProject.contracts) && dbProject.contracts.length > 0,
      'contract status=compiled': dbContract?.status === 'compiled',
      'abi present': Array.isArray(dbContract?.abi) && (dbContract?.abi?.length ?? 0) > 0,
      'bytecode present': typeof dbContract?.bytecode === 'string' && (dbContract?.bytecode?.length ?? 0) > 0,
      'version set': typeof dbContract?.solidityVersion === 'string',
    };

    for (const [name, pass] of Object.entries(checks)) {
      console.log(`   ${pass ? '✅' : '❌'} ${name}`);
    }

    const allPass = Object.values(checks).every(Boolean);
    console.log(`\n${'='.repeat(60)}`);
    console.log(allPass ? '🎉 ALL TESTS PASSED' : '❌ SOME TESTS FAILED');
    console.log('='.repeat(60));

    // Cleanup
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
