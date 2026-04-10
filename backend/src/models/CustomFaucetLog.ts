import mongoose, { Schema } from 'mongoose';
import type { ICustomFaucetLog } from '../types/index.js';

const customFaucetLogSchema = new Schema<ICustomFaucetLog>(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: [true, 'Project ID is required'],
      index: true,
    },
    contractId: {
      type: Schema.Types.ObjectId,
      required: [true, 'Contract ID is required'],
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    ipAddress: {
      type: String,
      required: [true, 'IP address is required'],
      index: true,
    },
    amountLabel: {
      type: String,
      required: [true, 'Amount label is required (e.g., 100 USDT, 1 NFT)'],
    },
    requestedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false, // We use requestedAt instead
  }
);

// Compound index for rate-limit checks:
// 1. Same user requesting from the same contract within timeframe
// 2. Same IP requesting from the same contract within timeframe
customFaucetLogSchema.index({ contractId: 1, userId: 1, requestedAt: -1 });
customFaucetLogSchema.index({ contractId: 1, ipAddress: 1, requestedAt: -1 });

const CustomFaucetLog = mongoose.model<ICustomFaucetLog>('CustomFaucetLog', customFaucetLogSchema);

export default CustomFaucetLog;
