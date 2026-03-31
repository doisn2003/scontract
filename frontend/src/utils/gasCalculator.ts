/**
 * gasCalculator.ts
 * Utility để tính phí Gas ước tính và thực tế.
 *
 * Gas Price: 1 Gwei (BSC Testnet avg)
 * BNB/USD: Fetch live từ backend /api/transactions/bnb-price
 *          Fallback: $600 nếu API lỗi
 */

import type { ethers } from 'ethers';

const GAS_PRICE_GWEI = 1;


// Cache giá BNB để tránh gọi API quá nhiều lần
let cachedBnbPrice: number | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60_000; // 1 phút

export async function fetchBnbPrice(): Promise<number> {
  const now = Date.now();
  if (cachedBnbPrice !== null && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedBnbPrice;
  }

  try {
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
    const token = localStorage.getItem('scontract_token');
    const res = await fetch(`${apiBase}/transactions/bnb-price`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error('API error');
    const json = await res.json() as { data: { priceUSD: number } };
    const price = json.data?.priceUSD;
    if (typeof price === 'number' && price > 0) {
      cachedBnbPrice = price;
      cacheTimestamp = now;
      return price;
    }
    throw new Error('Invalid price');
  } catch {
    return 600; // fallback
  }
}

/**
 * Tính chi phí gas từ gasLimit (đơn vị gas).
 */
export async function calculateCost(gasLimit: bigint | number): Promise<{
  gasBNB: string;
  gasUSD: string;
  bnbPrice: number;
}> {
  const bnbPrice = await fetchBnbPrice();
  const gasNum = typeof gasLimit === 'bigint' ? Number(gasLimit) : gasLimit;
  const gasBNB = (gasNum * GAS_PRICE_GWEI) / 1e9;
  const gasUSD = gasBNB * bnbPrice;
  return {
    gasBNB: gasBNB.toFixed(8),
    gasUSD: gasUSD.toFixed(4),
    bnbPrice,
  };
}

/**
 * Ước tính gas cho một hàm Write trước khi gọi thật.
 * Dùng ethers staticCall / estimateGas.
 *
 * @returns gasLimit ước tính (số đơn vị gas), hoặc null nếu không ước tính được
 */
export async function estimateGas(
  contract: ethers.Contract,
  functionName: string,
  args: unknown[],
  overrides?: Record<string, unknown>
): Promise<bigint | null> {
  try {
    const gasLimit: bigint = await contract[functionName].estimateGas(
      ...args,
      overrides ?? {}
    );
    return gasLimit;
  } catch {
    return null;
  }
}
