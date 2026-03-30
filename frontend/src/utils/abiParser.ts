/**
 * abiParser.ts
 * Parse ABI JSON → classify functions into read/write/payable categories.
 */

import type { AbiItem, AbiInput } from '../types';

export interface ParsedFunction {
  name: string;
  type: 'read' | 'write' | 'payable';
  inputs: AbiInput[];
  outputs: AbiInput[];
  stateMutability: string;
}

export interface ParsedEvent {
  name: string;
  inputs: AbiInput[];
  anonymous?: boolean;
}

export interface ParsedABI {
  constructorDef?: {
    inputs: AbiInput[];
    stateMutability: string;
  };
  functions: {
    read: ParsedFunction[];
    write: ParsedFunction[];
    payable: ParsedFunction[];
  };
  events: ParsedEvent[];
}

/**
 * Parse raw ABI array into structured categories.
 */
export function parseABI(abi: AbiItem[]): ParsedABI {
  const result: ParsedABI = {
    functions: { read: [], write: [], payable: [] },
    events: [],
  };

  for (const item of abi) {
    if (item.type === 'constructor') {
      result.constructorDef = {
        inputs: item.inputs || [],
        stateMutability: item.stateMutability || 'nonpayable',
      };
      continue;
    }

    if (item.type === 'event') {
      result.events.push({
        name: item.name || 'UnnamedEvent',
        inputs: item.inputs || [],
        anonymous: item.anonymous,
      });
      continue;
    }

    if (item.type === 'function' && item.name) {
      const fn: ParsedFunction = {
        name: item.name,
        type: 'write',
        inputs: item.inputs || [],
        outputs: item.outputs || [],
        stateMutability: item.stateMutability || 'nonpayable',
      };

      if (item.stateMutability === 'view' || item.stateMutability === 'pure') {
        fn.type = 'read';
        result.functions.read.push(fn);
      } else if (item.stateMutability === 'payable') {
        fn.type = 'payable';
        result.functions.payable.push(fn);
      } else {
        fn.type = 'write';
        result.functions.write.push(fn);
      }
    }
  }

  return result;
}

/**
 * Get a human-readable description of a Solidity type for placeholder text.
 */
export function getTypeHint(type: string): string {
  if (type === 'address') return '0x... (42 chars)';
  if (type === 'bool') return 'true or false';
  if (type.startsWith('uint')) return 'positive integer';
  if (type.startsWith('int')) return 'integer (can be negative)';
  if (type === 'string') return 'text string';
  if (type.startsWith('bytes')) return 'hex bytes (0x...)';
  if (type.includes('[]')) return 'JSON array, e.g. [1, 2, 3]';
  return type;
}

/**
 * Convert a user input string to the correct ethers.js-compatible value.
 */
export function parseInputValue(type: string, value: string): unknown {
  if (!value && value !== '0') return undefined;

  if (type === 'bool') {
    return value === 'true' || value === '1';
  }
  if (type === 'address') {
    return value.trim();
  }
  if (type.startsWith('uint') || type.startsWith('int')) {
    return value.trim(); // ethers handles BigInt conversion
  }
  if (type === 'string') {
    return value;
  }
  if (type.includes('[]') || type.startsWith('tuple')) {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}
