import mongoose, { Schema } from 'mongoose';
import type { IFaucetLog } from '../types/index.js';

const faucetLogSchema = new Schema<IFaucetLog>(
  {
    targetAddress: {
      type: String,
      required: [true, 'Target address is required'],
      lowercase: true,
      index: true,
    },
    ipAddress: {
      type: String,
      required: [true, 'IP address is required'],
      index: true,
    },
    txHash: {
      type: String,
      required: [true, 'Transaction hash is required'],
    },
    amount: {
      type: String,
      required: [true, 'Amount is required'],
    },
    requestedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false, // We use requestedAt instead
  }
);

// Compound index for rate-limit checks: same address or IP within timeframe
faucetLogSchema.index({ targetAddress: 1, requestedAt: -1 });
faucetLogSchema.index({ ipAddress: 1, requestedAt: -1 });

const FaucetLog = mongoose.model<IFaucetLog>('FaucetLog', faucetLogSchema);

export default FaucetLog;
