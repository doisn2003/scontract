// ========================
// Frontend Type Definitions
// ========================

// --- API Response ---
export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

// --- Auth ---
export interface User {
  _id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  name: string;
}

// --- Wallet ---
export type WalletType = 'owner' | 'user';

export interface Wallet {
  _id: string;
  userId: string;
  address: string;
  walletType: WalletType;
  label: string;
  createdAt: string;
  balance?: string; // fetched separately
}

// --- Project ---
export type ProjectStatus = 'created' | 'compiled' | 'deployed';

export interface Project {
  _id: string;
  userId: string;
  walletId: string | { _id: string; address: string };
  name: string;
  description: string;
  soliditySource: string;
  abi: AbiItem[] | null;
  bytecode: string | null;
  contractAddress: string | null;
  solidityVersion: string | null;
  status: ProjectStatus;
  network: string;
  createdAt: string;
  updatedAt: string;
}

// --- ABI ---
export interface AbiInput {
  name: string;
  type: string;
  indexed?: boolean;
  components?: AbiInput[];
}

export interface AbiItem {
  type: 'function' | 'event' | 'constructor' | 'fallback' | 'receive';
  name?: string;
  inputs?: AbiInput[];
  outputs?: AbiInput[];
  stateMutability?: 'pure' | 'view' | 'nonpayable' | 'payable';
  anonymous?: boolean;
}

// --- Transaction ---
export type TransactionStatus = 'pending' | 'success' | 'failed';

export interface Transaction {
  _id: string;
  projectId: string;
  userId: string;
  txHash: string;
  functionName: string;
  args: unknown[];
  gasUsed: number;
  gasCostBNB: string;
  gasCostUSD: string;
  status: TransactionStatus;
  createdAt: string;
}

// --- Faucet ---
export interface FaucetRequest {
  targetAddress: string;
}

export interface FaucetResponse {
  txHash: string;
  amount: string;
}

// --- Test ---
export type TestLibrary = 'ethers' | 'viem';

export interface TestCase {
  name: string;
  status: 'pass' | 'fail';
  duration: number;
  error?: string;
}

export interface TestResult {
  total: number;
  passing: number;
  failing: number;
  duration: number;
  cases: TestCase[];
}
