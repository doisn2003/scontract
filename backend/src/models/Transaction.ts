import mongoose, { Schema } from 'mongoose';
import type { ITransaction } from '../types/index.js';

const transactionSchema = new Schema<ITransaction>(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: [true, 'Project ID is required'],
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    txHash: {
      type: String,
      required: [true, 'Transaction hash is required'],
      unique: true,
    },
    functionName: {
      type: String,
      required: [true, 'Function name is required'],
    },
    args: {
      type: Schema.Types.Mixed,
      default: [],
    },
    gasUsed: {
      type: Number,
      default: 0,
    },
    gasCostBNB: {
      type: String,
      default: '0',
    },
    gasCostUSD: {
      type: String,
      default: '0',
    },
    status: {
      type: String,
      enum: ['pending', 'success', 'failed'],
      default: 'pending',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for transaction history queries
transactionSchema.index({ projectId: 1, createdAt: -1 });
transactionSchema.index({ userId: 1, createdAt: -1 });

const Transaction = mongoose.model<ITransaction>('Transaction', transactionSchema);

export default Transaction;
