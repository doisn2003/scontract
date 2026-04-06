/**
 * cache-compilers.js
 * Pre-download Solidity compiler binaries into the Docker image at build time.
 * This script runs ONCE during `docker build` so containers at runtime
 * can operate with --network=none (faster + more secure).
 *
 * Method: Create a minimal Hardhat project per version, run `compile` on a
 * trivial contract to trigger solc download and cache it under
 * ~/.cache/hardhat-nodejs/compilers/
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Versions to pre-cache — covers most common use cases
const VERSIONS_TO_CACHE = [
  '0.8.28',
  '0.8.26',
  '0.8.25',
  '0.8.24',
  '0.8.20',
  '0.8.19',
  '0.8.17',
  '0.8.15',
  '0.8.0',
  '0.7.6',
  '0.6.12',
  '0.5.16',
];

function createMinimalProject(tmpDir, version) {
  fs.mkdirSync(path.join(tmpDir, 'contracts'), { recursive: true });

  // Minimal Solidity contract for this version
  const majorMinor = version.split('.').slice(0, 2).join('.');
  fs.writeFileSync(
    path.join(tmpDir, 'contracts', 'Stub.sol'),
    `// SPDX-License-Identifier: MIT\npragma solidity ^${version};\ncontract Stub {}\n`,
    'utf-8'
  );

  fs.writeFileSync(
    path.join(tmpDir, 'hardhat.config.js'),
    `module.exports = { solidity: "${version}" };\n`,
    'utf-8'
  );
}

function cacheCompiler(version) {
  const tmpDir = path.join(os.tmpdir(), `cache-${version}`);
  try {
    process.stdout.write(`→ Caching solc ${version}... `);
    createMinimalProject(tmpDir, version);

    execSync('npx hardhat compile --quiet', {
      cwd: tmpDir,
      stdio: 'pipe',
      timeout: 120_000,
      env: { ...process.env, HARDHAT_DISABLE_TELEMETRY_PROMPT: '1' },
    });

    console.log('✅ done');
  } catch (err) {
    // Non-fatal: if a version fails to cache, runtime will still try with network
    console.log(`⚠️  skipped (${err.message?.split('\n')[0] ?? 'unknown error'})`);
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
  }
}

console.log('📦 Pre-caching Solidity compilers into Docker image...');
for (const version of VERSIONS_TO_CACHE) {
  cacheCompiler(version);
}
console.log('✅ Compiler cache complete.');
