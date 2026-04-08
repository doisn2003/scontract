import { ethers } from 'ethers';
import FaucetLog from '../models/FaucetLog.js';
import SystemConfig from '../models/SystemConfig.js';
import { sendError } from '../utils/response.js';

/**
 * Handle Faucet request: check rate limit and send funds.
 */
export async function requestFaucet(targetAddress: string, ipAddress: string) {
  // Query configurations from DB
  const limitConfig = await SystemConfig.findOne({ key: 'faucet_native_limit' });
  const maxConfig = await SystemConfig.findOne({ key: 'faucet_daily_max' });
  
  const amount = limitConfig?.value || process.env.FAUCET_AMOUNT || '0.001';
  const dailyMax = parseInt(maxConfig?.value || '5', 10);
  
  const cooldownHours = 24; // Check within 24h window
  const rpcUrl = process.env.RPC_URL;
  const masterPrivateKey = process.env.MASTER_PRIVATE_KEY;

  if (!rpcUrl || !masterPrivateKey) {
    throw new Error('RPC_URL or MASTER_PRIVATE_KEY is not configured');
  }

  // 1. Rate Limit Check (Address & IP)
  const cooldownDate = new Date();
  cooldownDate.setHours(cooldownDate.getHours() - cooldownHours);

  // Check how many times this address or IP has requested in the last 24 hours
  const requestCount = await FaucetLog.countDocuments({
    $or: [
      { targetAddress: targetAddress.toLowerCase(), requestedAt: { $gte: cooldownDate } },
      { ipAddress: ipAddress, requestedAt: { $gte: cooldownDate } },
    ],
  });

  if (requestCount >= dailyMax) {
    throw new Error(`Daily limit reached. At most ${dailyMax} requests per 24 hours.`);
  }

  // 2. Setup Provider and Wallet
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(masterPrivateKey, provider);

  // 3. Send Transaction
  try {
    const tx = await wallet.sendTransaction({
      to: targetAddress,
      value: ethers.parseEther(amount),
    });

    // 4. Log the faucet request
    const faucetLog = await FaucetLog.create({
      targetAddress: targetAddress.toLowerCase(),
      ipAddress,
      txHash: tx.hash,
      amount,
      requestedAt: new Date(),
    });

    return {
      txHash: tx.hash,
      amount,
      targetAddress: targetAddress.toLowerCase(),
      requestedAt: faucetLog.requestedAt,
    };
  } catch (error) {
    console.error('Faucet Error:', error);
    if (error instanceof Error && error.message.includes('insufficient funds')) {
       throw new Error('Master wallet balance is insufficient. Please contact administrator.');
    }
    throw new Error('Failed to send tokens. Please try again later.');
  }
}

/**
 * Get faucet history for a specific address
 */
export async function getFaucetHistory(address: string) {
  return FaucetLog.find({ targetAddress: address.toLowerCase() })
    .sort({ requestedAt: -1 })
    .limit(10)
    .lean();
}
