import { ethers } from 'ethers';
import Wallet from '../models/Wallet.js';
import { encrypt, decrypt } from '../utils/encryption.js';
import type { WalletType } from '../types/index.js';

/**
 * BIP44 Derivation Path for BSC/Ethereum:
 * m/44'/60'/0'/0/{index}
 *
 * - 44'  = BIP44 standard
 * - 60'  = Ethereum/BSC coin type
 * - 0'   = account
 * - 0    = external chain
 * - {i}  = address index (incremented per owner wallet)
 */
const BIP44_BASE_PATH = "m/44'/60'/0'/0";

/**
 * Create a new wallet for a user.
 * - walletType 'owner': Derived from Master Mnemonic via BIP44 HD Wallet
 * - walletType 'user':  Generated randomly (ethers.Wallet.createRandom)
 */
export async function createWallet(
  userId: string,
  walletType: WalletType = 'user',
  label: string = 'My Wallet'
) {
  let address: string;
  let privateKey: string;
  let derivationIndex: number | null = null;

  if (walletType === 'owner') {
    // ===== Owner Wallet: HD derivation from Master Mnemonic =====
    const mnemonic = process.env.MASTER_MNEMONIC;
    if (!mnemonic) {
      throw new Error('MASTER_MNEMONIC is not configured in .env');
    }

    // Determine next derivation index
    const lastOwnerWallet = await Wallet.findOne({ walletType: 'owner' })
      .sort({ derivationIndex: -1 })
      .select('derivationIndex')
      .lean();

    derivationIndex = lastOwnerWallet?.derivationIndex != null
      ? lastOwnerWallet.derivationIndex + 1
      : 0;

    // Derive wallet from mnemonic using BIP44 path
    const hdNode = ethers.HDNodeWallet.fromPhrase(
      mnemonic,
      undefined,            // no password
      `${BIP44_BASE_PATH}/${derivationIndex}`
    );

    address = hdNode.address.toLowerCase();
    privateKey = hdNode.privateKey;
  } else {
    // ===== User Wallet: Random generation =====
    const randomWallet = ethers.Wallet.createRandom();
    address = randomWallet.address.toLowerCase();
    privateKey = randomWallet.privateKey;
  }

  // Encrypt the private key before storing (AES-256-CBC)
  const encryptedPrivateKey = encrypt(privateKey);

  // Save to DB
  const wallet = await Wallet.create({
    userId,
    address,
    encryptedPrivateKey,
    walletType,
    label,
    derivationIndex,
  });

  return {
    _id: wallet._id,
    address: wallet.address,
    walletType: wallet.walletType,
    label: wallet.label,
    derivationIndex: wallet.derivationIndex,
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
