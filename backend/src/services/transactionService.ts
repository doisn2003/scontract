/**
 * transactionService.ts
 * Business logic for recording and querying Transaction History.
 *
 * Luồng lưu trữ: Frontend gọi POST /api/transactions sau khi tx.wait() confirm.
 * Backend tính lại gasCostBNB/USD dựa trên gasUsed nhận được.
 *
 * Gas Price mặc định: 10 Gwei (trung bình BSC Testnet)
 * BNB/USD: Fetch live từ Binance Public API
 */

import Transaction from '../models/Transaction.js';

// ── Hằng số Gas ──
const GAS_PRICE_GWEI = 1;


/**
 * Lấy giá BNB/USD thời gian thực từ Binance Public API.
 * Fallback về giá hardcoded 600 nếu API lỗi.
 */
async function getBnbPriceUSD(): Promise<number> {
  try {
    const res = await fetch(
      'https://api.binance.com/api/v3/ticker/price?symbol=BNBUSDT',
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) throw new Error('Binance API error');
    const json = await res.json() as { price: string };
    const price = parseFloat(json.price);
    if (isNaN(price) || price <= 0) throw new Error('Invalid price');
    return price;
  } catch {
    console.warn('[transactionService] Binance API failed, using fallback BNB price: $600');
    return 600;
  }
}

/**
 * Tính chi phí gas từ gasUsed.
 * @param gasUsed - Số đơn vị gas thực tế đã dùng
 * @returns { gasCostBNB, gasCostUSD } dạng string (có 8 chữ số thập phân)
 */
async function calculateGasCost(gasUsed: number): Promise<{
  gasCostBNB: string;
  gasCostUSD: string;
  bnbPrice: number;
}> {
  const bnbPrice = await getBnbPriceUSD();
  const gasCostBNB = (gasUsed * GAS_PRICE_GWEI) / 1e9;
  const gasCostUSD = gasCostBNB * bnbPrice;
  return {
    gasCostBNB: gasCostBNB.toFixed(8),
    gasCostUSD: gasCostUSD.toFixed(4),
    bnbPrice,
  };
}

// ──────────────────────────────
// Create Transaction Record
// ──────────────────────────────

export interface CreateTransactionPayload {
  projectId: string;
  contractId?: string | null;
  userId: string;
  txHash: string;
  functionName: string;
  args?: unknown[];
  gasUsed: number;
  status?: 'pending' | 'success' | 'failed';
}

export async function createTransaction(payload: CreateTransactionPayload) {
  const {
    projectId,
    contractId = null,
    userId,
    txHash,
    functionName,
    args = [],
    gasUsed,
    status = 'success',
  } = payload;

  const { gasCostBNB, gasCostUSD } = await calculateGasCost(gasUsed);

  const tx = await Transaction.create({
    projectId,
    contractId,
    userId,
    txHash,
    functionName,
    args,
    gasUsed,
    gasCostBNB,
    gasCostUSD,
    status,
  });

  return tx;
}

// ──────────────────────────────
// Get Transaction History
// ──────────────────────────────

export interface GetTransactionsOptions {
  userId: string;
  projectId?: string;
  page?: number;
  limit?: number;
}

export async function getTransactions(opts: GetTransactionsOptions) {
  const { userId, projectId, page = 1, limit = 20 } = opts;
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = { userId };
  if (projectId) filter.projectId = projectId;

  const [transactions, total] = await Promise.all([
    Transaction.find(filter)
      .populate('projectId', 'name network contractAddress')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Transaction.countDocuments(filter),
  ]);

  return {
    transactions,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  };
}

export { getBnbPriceUSD };
