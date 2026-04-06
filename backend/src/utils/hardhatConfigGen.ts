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

  // Helper to get safe settings based on version
  const getCompilerSettings = (version: string) => {
    const settings: any = {
      optimizer: { enabled: true, runs: 200 },
    };

    // 'cancun' only supported in 0.8.24+
    // 'shanghai' only supported in 0.8.20+
    // For older versions, let solc use its default or specify a safe one
    const ver = version.split('.').map(Number);
    if (ver[0] === 0 && ver[1] === 8 && ver[2] >= 24) {
      settings.evmVersion = "cancun";
    } else if (ver[0] === 0 && ver[1] === 8 && ver[2] >= 20) {
      settings.evmVersion = "shanghai";
    } else if (ver[0] === 0 && ver[1] === 8 && ver[2] >= 18) {
      settings.evmVersion = "paris";
    } else if (ver[0] === 0 && ver[1] === 8 && ver[2] >= 15) {
        // Safe for middle 0.8.x
        settings.evmVersion = "london";
    }
    // For very old versions, we don't specify evmVersion to use solc default
    
    return settings;
  };

  const config = `
${pluginRequire}

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    compilers: [
      {
        version: "${solidityVersion}",
        settings: ${JSON.stringify(getCompilerSettings(solidityVersion), null, 10).replace(/\n\s+}/g, ' }')}
      },
      {
        version: "0.8.24",
        settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: "cancun" }
      },
      {
        version: "0.8.26",
        settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: "cancun" }
      }
    ]
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
