/**
 * hardhatConfigGen.ts
 * Utility: Dynamically generate hardhat.config.js content for the Docker sandbox.
 *
 * The generated config is written to the sandbox temp directory before
 * mounting into the container. This allows per-project Solidity version
 * and plugin selection without modifying the Docker image.
 */

export type HardhatPlugin = 'toolbox' | 'viem' | 'none';
export type HardhatNetwork = 'hardhat' | 'bscTestnet';

export interface HardhatConfigOptions {
  solidityVersion: string;
  plugin: HardhatPlugin;
  network?: HardhatNetwork;
  // BSC Testnet deployment credentials (only needed when network = 'bscTestnet')
  rpcUrl?: string;
  privateKey?: string;
}

/**
 * Generate the content of hardhat.config.js as a string.
 *
 * @param options - Configuration options
 * @returns string content of hardhat.config.js
 */
export function generateHardhatConfig(options: HardhatConfigOptions): string {
  const {
    solidityVersion,
    plugin,
    network = 'hardhat',
    rpcUrl,
    privateKey,
  } = options;

  // Build require statement based on plugin choice
  let pluginRequire = '';
  if (plugin === 'toolbox') {
    pluginRequire = `require("@nomicfoundation/hardhat-toolbox");`;
  } else if (plugin === 'viem') {
    pluginRequire = `require("@nomicfoundation/hardhat-viem");`;
  }
  // plugin === 'none' → no require (bare compile only)

  // Build networks block
  let networksBlock = '';
  if (network === 'bscTestnet' && rpcUrl && privateKey) {
    networksBlock = `
  bscTestnet: {
    url: "${rpcUrl}",
    chainId: 97,
    accounts: ["${privateKey}"],
    gasPrice: 10000000000, // 10 Gwei
  },`;
  }

  const config = `
${pluginRequire}

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "${solidityVersion}",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      evmVersion: "paris",
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },${networksBlock}
  },
  paths: {
    sources: "/app/project/contracts",
    tests: "/app/project/test",
    cache: "/app/project/cache",
    artifacts: "/app/project/artifacts",
  },
};
`.trimStart();

  return config;
}

/**
 * Generate hardhat.config.js for COMPILE ONLY (no network needed).
 * Simplified version for Phase 3 testing.
 */
export function generateCompileOnlyConfig(solidityVersion: string): string {
  return generateHardhatConfig({
    solidityVersion,
    plugin: 'none',
    network: 'hardhat',
  });
}

/**
 * Generate hardhat.config.js for LOCAL TESTING on Hardhat Network.
 */
export function generateTestConfig(solidityVersion: string, plugin: HardhatPlugin = 'toolbox'): string {
  return generateHardhatConfig({
    solidityVersion,
    plugin,
    network: 'hardhat',
  });
}

/**
 * Generate hardhat.config.js for BSC TESTNET DEPLOYMENT.
 */
export function generateDeployConfig(
  solidityVersion: string,
  rpcUrl: string,
  privateKey: string
): string {
  return generateHardhatConfig({
    solidityVersion,
    plugin: 'toolbox',
    network: 'bscTestnet',
    rpcUrl,
    privateKey,
  });
}
