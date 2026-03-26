import { ethers } from 'ethers';
import Wallet from '../models/Wallet.js';
import { encrypt, decrypt } from '../utils/encryption.js';
import type { WalletType } from '../types/index.js';

/**
 * Create a new random wallet for a user.
 */
export async function createWallet(
  userId: string,
  walletType: WalletType = 'user',
  label: string = 'My Wallet'
) {
  // Generate a random wallet
  const randomWallet = ethers.Wallet.createRandom();
  const address = randomWallet.address.toLowerCase();
  const privateKey = randomWallet.privateKey;

  // Encrypt the private key before storing
  const encryptedPrivateKey = encrypt(privateKey);

  // Save to DB
  const wallet = await Wallet.create({
    userId,
    address,
    encryptedPrivateKey,
    walletType,
    label,
  });

  return {
    _id: wallet._id,
    address: wallet.address,
    walletType: wallet.walletType,
    label: wallet.label,
    createdAt: wallet.createdAt,
  };
}

/**
 * Get all wallets for a user (without private keys).
 */
export async function getWallets(userId: string) {
  const wallets = await Wallet.find({ userId })
    .select('-encryptedPrivateKey')
    .sort({ createdAt: -1 })
    .lean();
  return wallets;
}

/**
 * Get a single wallet by ID (must belong to user).
 */
export async function getWalletById(walletId: string, userId: string) {
  const wallet = await Wallet.findOne({ _id: walletId, userId })
    .select('-encryptedPrivateKey')
    .lean();
  return wallet;
}

/**
 * Decrypt and return the private key of a wallet.
 * Only the wallet owner can access this.
 */
export async function getPrivateKey(walletId: string, userId: string) {
  const wallet = await Wallet.findOne({ _id: walletId, userId });
  if (!wallet) {
    return null;
  }
  const privateKey = decrypt(wallet.encryptedPrivateKey);
  return privateKey;
}

/**
 * Get the balance of a wallet address from the blockchain.
 */
export async function getWalletBalance(address: string): Promise<string> {
  const rpcUrl = process.env.RPC_URL;
  if (!rpcUrl) {
    throw new Error('RPC_URL is not configured');
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const balanceWei = await provider.getBalance(address);
  const balanceEther = ethers.formatEther(balanceWei);
  return balanceEther;
}

/**
 * Count total wallets for a user.
 */
export async function countWallets(userId: string): Promise<number> {
  return Wallet.countDocuments({ userId });
}
