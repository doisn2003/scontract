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
 * - {i}  = address index (auto-incremented globally)
 *
 * ALL wallets (regardless of role) are derived from MASTER_MNEMONIC.
 * The walletType field is purely a contextual role label:
 *   - 'owner': user deployed a contract with this wallet
 *   - 'user':  user interacts with others' contracts via this wallet
 * A single wallet CAN serve both roles depending on context.
 */
const BIP44_BASE_PATH = "m/44'/60'/0'/0";

/**
 * Get the next available derivation index.
 * Uses a global counter across ALL wallets to ensure unique paths.
 */
async function getNextDerivationIndex(): Promise<number> {
  const lastWallet = await Wallet.findOne({ derivationIndex: { $ne: null } })
    .sort({ derivationIndex: -1 })
    .select('derivationIndex')
    .lean();

  return lastWallet?.derivationIndex != null
    ? lastWallet.derivationIndex + 1
    : 0;
}

/**
 * Create a new wallet for a user.
 *
 * ALL wallets are derived from MASTER_MNEMONIC via BIP44 HD Wallet.
 * This ensures deterministic and recoverable key generation.
 *
 * The `walletType` is just a contextual role label — one wallet
 * can be used as both 'owner' (deploy contracts) and 'user'
 * (interact with others' contracts).
 */
export async function createWallet(
  userId: string,
  walletType: WalletType = 'user',
  label: string = 'My Wallet'
) {
  const mnemonic = process.env.MASTER_MNEMONIC;
  if (!mnemonic) {
    throw new Error(
      'MASTER_MNEMONIC is not configured in .env. ' +
      'All wallets are derived from this mnemonic via BIP44.'
    );
  }

  // Get the next unique derivation index
  const derivationIndex = await getNextDerivationIndex();
  const derivationPath = `${BIP44_BASE_PATH}/${derivationIndex}`;

  // Derive wallet from mnemonic using BIP44 path
  const hdNode = ethers.HDNodeWallet.fromPhrase(
    mnemonic,
    undefined,       // no password
    derivationPath
  );

  const address = hdNode.address.toLowerCase();
  const privateKey = hdNode.privateKey;

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
