/**
 * testSandbox.ts — Manual Integration Test Script for Phase 3
 *
 * Chạy bằng: cd backend && npx ts-node src/scripts/testSandbox.ts
 *
 * Tests:
 *   1. solidityParser — extract version và contract name
 *   2. hardhatConfigGen — sinh config hợp lệ
 *   3. deployScriptGen — sinh script hợp lệ
 *   4. sandboxService.compileContract() — end-to-end compile trong Docker
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { extractSolidityVersion, extractContractName } from '../utils/solidityParser.js';
import { generateHardhatConfig, generateCompileOnlyConfig } from '../utils/hardhatConfigGen.js';
import { generateCompileScript } from '../utils/deployScriptGen.js';
import { compileContract } from '../services/sandboxService.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// === TEST 1: solidityParser ===
console.log('\n' + '='.repeat(60));
console.log('TEST 1: solidityParser');
console.log('='.repeat(60));

const testSource1 = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract SimpleStorage {
    uint256 private value;
    function set(uint256 v) public { value = v; }
    function get() public view returns (uint256) { return value; }
}`;

const version = extractSolidityVersion(testSource1);
const name = extractContractName(testSource1);

console.log(`Version extracted: "${version}"`);
console.log(`Contract name extracted: "${name}"`);

const pass1a = version === '0.8.20';
const pass1b = name === 'SimpleStorage';
console.log(`✅ Version correct: ${pass1a}`);
console.log(`✅ Name correct: ${pass1b}`);

// Test edge cases
const versionNoCarets = extractSolidityVersion('pragma solidity 0.7.6;');
const versionGte = extractSolidityVersion('pragma solidity >=0.8.0 <0.9.0;');
console.log(`Version no caret: "${versionNoCarets}" (expected: 0.7.6)`);
console.log(`Version >=: "${versionGte}" (expected: 0.8.0)`);

// === TEST 2: hardhatConfigGen ===
console.log('\n' + '='.repeat(60));
console.log('TEST 2: hardhatConfigGen');
console.log('='.repeat(60));

const config = generateCompileOnlyConfig('0.8.20');
console.log('Generated hardhat.config.js:');
console.log(config);
const hasVersion = config.includes('"0.8.20"');
const hasPaths = config.includes('/app/project/contracts');
console.log(`✅ Contains solidity version: ${hasVersion}`);
console.log(`✅ Contains correct paths: ${hasPaths}`);

// === TEST 3: deployScriptGen ===
console.log('\n' + '='.repeat(60));
console.log('TEST 3: deployScriptGen');
console.log('='.repeat(60));

const script = generateCompileScript('SimpleStorage');
const scriptHasResultPath = script.includes('result.json');
const scriptHasReadArtifact = script.includes('readArtifact');
console.log(`✅ Script has result path: ${scriptHasResultPath}`);
console.log(`✅ Script reads artifacts: ${scriptHasReadArtifact}`);

// === TEST 4: Full Docker Compile ===
console.log('\n' + '='.repeat(60));
console.log('TEST 4: Docker compile (end-to-end)');
console.log('='.repeat(60));
console.log('⏳ This requires Docker to be running. Starting container...');

// Read SimpleStorage.sol
// __dirname khi chạy ts-node từ backend/src/scripts/ → lên 3 cấp để đến scontract/
const solidityPath = path.resolve(__dirname, '../../../..', 'contracts', 'SimpleStorage.sol');
// Fallback: thử path tương đối từ cwd
const solidityPathAlt = path.resolve(process.cwd(), '..', 'contracts', 'SimpleStorage.sol');
const resolvedPath = fs.existsSync(solidityPath) ? solidityPath : solidityPathAlt;
console.log(`📁 Looking for SimpleStorage.sol at:\n  [1] ${solidityPath}\n  [2] ${solidityPathAlt}`);

if (!fs.existsSync(resolvedPath)) {
  console.error(`❌ SimpleStorage.sol not found! Tried:\n  ${solidityPath}\n  ${solidityPathAlt}`);
  process.exit(1);
}

const soliditySource = fs.readFileSync(resolvedPath, 'utf-8');
console.log(`📄 Source file: ${resolvedPath}`);

try {
  const result = await compileContract(soliditySource, 'SimpleStorage');
  console.log('\n📊 Compile Result:');
  console.log(`  success: ${result.success}`);
  console.log(`  contractName: ${result.contractName}`);

  if (result.success) {
    console.log(`  ABI entries: ${result.abi?.length ?? 0}`);
    console.log(`  Bytecode starts with: ${result.bytecode?.substring(0, 20)}...`);
    console.log('✅ TEST 4 PASSED: Docker compilation successful!');
  } else {
    console.error(`❌ TEST 4 FAILED: ${result.error}`);
    console.error(`   Details: ${result.details}`);
  }
} catch (err) {
  console.error('❌ TEST 4 EXCEPTION:', err);
}

console.log('\n' + '='.repeat(60));
console.log('Phase 3 Test Complete');
console.log('='.repeat(60));
