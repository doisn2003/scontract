import type { Request } from 'express';
import type { Document, Types } from 'mongoose';

// ========================
// Express Extensions
// ========================
export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

// ========================
// API Response
// ========================
export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

// ========================
// Model Enums
// ========================
export type WalletType = 'owner' | 'user';

export type ProjectStatus = 'created' | 'compiled' | 'deployed';

export type TransactionStatus = 'pending' | 'success' | 'failed';

export type TestLibrary = 'ethers' | 'viem';

// ========================
// Document Interfaces
// ========================
export interface IUser extends Document {
  _id: Types.ObjectId;
  email: string;
  password: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

export interface IWallet extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  address: string;
  encryptedPrivateKey: string;
  walletType: WalletType;
  label: string;
  createdAt: Date;
}

export interface IProject extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  walletId: Types.ObjectId;
  name: string;
  description: string;
  soliditySource: string;
  abi: Record<string, unknown>[];
  bytecode: string;
  contractAddress: string;
  solidityVersion: string;
  status: ProjectStatus;
  network: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IFaucetLog extends Document {
  _id: Types.ObjectId;
  targetAddress: string;
  ipAddress: string;
  txHash: string;
  amount: string;
  requestedAt: Date;
}

export interface ITransaction extends Document {
  _id: Types.ObjectId;
  projectId: Types.ObjectId;
  userId: Types.ObjectId;
  txHash: string;
  functionName: string;
  args: unknown[];
  gasUsed: number;
  gasCostBNB: string;
  gasCostUSD: string;
  status: TransactionStatus;
  createdAt: Date;
}
