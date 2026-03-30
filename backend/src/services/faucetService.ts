import { ethers } from 'ethers';
import FaucetLog from '../models/FaucetLog.js';
import { sendError } from '../utils/response.js';

/**
 * Handle Faucet request: check rate limit and send funds.
 */
export async function requestFaucet(targetAddress: string, ipAddress: string) {
  const amount = process.env.FAUCET_AMOUNT || '0.05';
  const cooldownHours = parseInt(process.env.FAUCET_COOLDOWN_HOURS || '24');
  const rpcUrl = process.env.RPC_URL;
  const masterPrivateKey = process.env.MASTER_PRIVATE_KEY;

  if (!rpcUrl || !masterPrivateKey) {
    throw new Error('RPC_URL or MASTER_PRIVATE_KEY is not configured');
  }

  // 1. Rate Limit Check (Address & IP)
  const cooldownDate = new Date();
  cooldownDate.setHours(cooldownDate.getHours() - cooldownHours);

  // Check if this address or IP has requested in the last 24 hours
  const existingLog = await FaucetLog.findOne({
    $or: [
      { targetAddress: targetAddress.toLowerCase(), requestedAt: { $gte: cooldownDate } },
      { ipAddress: ipAddress, requestedAt: { $gte: cooldownDate } },
    ],
  });

  if (existingLog) {
    const hoursLeft = Math.ceil(
      (existingLog.requestedAt.getTime() + cooldownHours * 60 * 60 * 1000 - Date.now()) / (60 * 60 * 1000)
    );
    throw new Error(`Cooldown active. Please try again in ${hoursLeft} hours.`);
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
