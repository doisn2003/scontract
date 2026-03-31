/**
 * solidityParser.ts
 * Utility: Extract Solidity compiler version from source code pragma statement.
 */

/**
 * Extract the Solidity version from a pragma statement.
 *
 * Supports formats:
 *   pragma solidity ^0.8.20;       → "0.8.20"
 *   pragma solidity >=0.8.0 <0.9.0; → "0.8.0"
 *   pragma solidity 0.8.20;        → "0.8.20"
 *   pragma solidity ~0.7.6;        → "0.7.6"
 *
 * @param source - Solidity source code string
 * @returns version string like "0.8.20", or "0.8.20" as fallback
 */
export function extractSolidityVersion(source: string): string {
  const FALLBACK_VERSION = '0.8.20';

  // Regex: match `pragma solidity` followed by optional operators (^, >=, ~, =) and the version number
  const pragmaRegex = /pragma\s+solidity\s+(?:\^|>=|>|~|=)?\s*(\d+\.\d+\.\d+)/;
  const match = source.match(pragmaRegex);

  if (!match || !match[1]) {
    console.warn('[solidityParser] No pragma solidity found, using fallback:', FALLBACK_VERSION);
    return FALLBACK_VERSION;
  }

  const version = match[1].trim();
  console.log(`[solidityParser] Extracted Solidity version: ${version}`);
  return version;
}

/**
 * Extract the contract name(s) from Solidity source code.
 * Returns the LAST contract defined (as it's usually the main one).
 *
 * @param source - Solidity source code string
 * @returns contract name string, or "MyContract" as fallback
 */
export function extractContractName(source: string): string {
  const FALLBACK_NAME = 'MyContract';

  // Match all `contract MyName` or `contract MyName is BaseContract`
  const contractRegex = /\bcontract\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*(?:is\s+[^{]+)?\{/g;
  const matches: string[] = [];

  let match;
  while ((match = contractRegex.exec(source)) !== null) {
    matches.push(match[1]);
  }

  if (matches.length === 0) {
    console.warn('[solidityParser] No contract found, using fallback:', FALLBACK_NAME);
    return FALLBACK_NAME;
  }

  // Return last contract (typically the main deployable contract)
  const name = matches[matches.length - 1];
  console.log(`[solidityParser] Extracted contract name: ${name}`);
  return name;
}

import { ethers } from 'ethers';

/**
 * Scan Solidity source code for address literals and ensure they are checksummed.
 * This fixes the 'invalid checksum' compiler error automatically.
 */
export function repairAddressChecksums(source: string): string {
  // Regex to find things that look like Ethereum addresses: 0x followed by 40 hex chars
  // We use word boundaries to avoid matching longer strings or different formats
  const addressRegex = /\b0x[a-fA-F0-9]{40}\b/g;
  
  let repairedSource = source;
  const matches = source.match(addressRegex);
  
  if (matches) {
    const uniqueMatches = Array.from(new Set(matches));
    uniqueMatches.forEach(addr => {
      try {
        if (ethers.isAddress(addr)) {
          const checksummed = ethers.getAddress(addr);
          if (addr !== checksummed) {
            console.log(`[solidityParser] Auto-repairing checksum: ${addr} -> ${checksummed}`);
            // Use global replace to fix all occurrences of this specific address
            repairedSource = repairedSource.split(addr).join(checksummed);
          }
        }
      } catch (e) {
        // Not a valid address or encoding issue, skip
      }
    });
  }
  
  return repairedSource;
}
