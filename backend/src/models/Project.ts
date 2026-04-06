import mongoose, { Schema } from 'mongoose';
import type { IProject } from '../types/index.js';

// ── Sub-schema: Smart Contract ─────────────────────────────────────────────
const smartContractSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Contract name is required'],
      trim: true,
      maxlength: [100, 'Contract name cannot exceed 100 characters'],
      default: 'MyContract',
    },
    soliditySource: {
      type: String,
      required: [true, 'Solidity source code is required'],
    },
    abi: {
      type: Schema.Types.Mixed,
      default: null,
    },
    bytecode: {
      type: String,
      default: null,
    },
    contractAddress: {
      type: String,
      default: null,
    },
    solidityVersion: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ['created', 'compiled', 'deployed'],
      default: 'created',
      required: true,
    },
  },
  {
    timestamps: true,
    _id: true, // Mỗi contract có _id riêng để dễ target
  }
);

// ── Main Project Schema ────────────────────────────────────────────────────
const projectSchema = new Schema<IProject>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    walletId: {
      type: Schema.Types.ObjectId,
      ref: 'Wallet',
      required: [true, 'Wallet ID is required'],
    },
    name: {
      type: String,
      required: [true, 'Project name is required'],
      trim: true,
      maxlength: [100, 'Project name cannot exceed 100 characters'],
    },
    description: {
      type: String,
      default: '',
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    network: {
      type: String,
      default: 'bsc-testnet',
    },
    contracts: {
      type: [smartContractSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Indexes: list user's projects, explore deployed projects
projectSchema.index({ userId: 1, createdAt: -1 });

const Project = mongoose.model<IProject>('Project', projectSchema);

export default Project;
