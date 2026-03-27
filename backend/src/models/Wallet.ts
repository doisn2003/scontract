import mongoose, { Schema } from 'mongoose';
import type { IWallet } from '../types/index.js';

const walletSchema = new Schema<IWallet>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    address: {
      type: String,
      required: [true, 'Wallet address is required'],
      unique: true,
      lowercase: true,
    },
    encryptedPrivateKey: {
      type: String,
      required: [true, 'Encrypted private key is required'],
    },
    walletType: {
      type: String,
      enum: ['owner', 'user'],
      default: 'user',
      required: true,
    },
    label: {
      type: String,
      default: 'My Wallet',
      trim: true,
      maxlength: [30, 'Label cannot exceed 30 characters'],
    },
    derivationIndex: {
      type: Number,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index: list wallets for a user efficiently
walletSchema.index({ userId: 1, createdAt: -1 });

const Wallet = mongoose.model<IWallet>('Wallet', walletSchema);

export default Wallet;
