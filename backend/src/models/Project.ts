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
    faucetConfig: {
      isEnabled: { type: Boolean, default: false },
      tokenType: {
        type: String,
        enum: ['ERC20', 'ERC721', 'ERC1155', 'UNKNOWN'],
        default: 'UNKNOWN',
      },
      amountPerRequest: { type: String, default: '0' },
      cooldownHours: { type: Number, default: 24 },
      maxTotalDrained: { type: String, default: '0' },
      mintFunctionName: { type: String, default: 'mint' },
      faucetTokenId: { type: String, default: '' },
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
    guest_permissions: [
      {
        contractAddress: { type: String, required: true },
        methodName: { type: String, required: true },
        isGlobalAllowed: { type: Boolean, default: false },
        allowedGuestList: { type: [String], default: [] }, // Emails of allowed guests
        note: { type: String, default: '' }, // Markdown explanations
      }
    ],
    global_access_config: {
      invited_guests: { type: [String], default: [] },
      allow_all_guests: { type: Boolean, default: false },
      allow_all_devs: { type: Boolean, default: false },
      allow_read: { type: Boolean, default: false },
      allow_write: { type: Boolean, default: false },
      allow_payable: { type: Boolean, default: false },
    },
    shared_devs: {
      type: [Schema.Types.ObjectId],
      ref: 'User',
      default: [], // List of user IDs (Devs) allowed to view/edit
    }
  },
  {
    timestamps: true,
  }
);

// Indexes: list user's projects, explore deployed projects
projectSchema.index({ userId: 1, createdAt: -1 });

const Project = mongoose.model<IProject>('Project', projectSchema);

export default Project;
