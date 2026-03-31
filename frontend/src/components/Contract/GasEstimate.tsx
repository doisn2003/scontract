/**
 * GasEstimate.tsx
 * Hiển thị phí gas ước tính realtime bên cạnh nút Execute.
 * Gọi estimateGas mỗi khi args thay đổi (debounced 600ms).
 */

import { useState, useEffect, useRef } from 'react';
import { ethers } from 'ethers';
import { estimateGas, calculateCost } from '../../utils/gasCalculator';
import type { ParsedFunction } from '../../utils/abiParser';
import './GasEstimate.css';

interface GasEstimateProps {
  contractAddress: string;
  abi: unknown[];
  fn: ParsedFunction;
  args: unknown[];
  payableValue?: string; // ETH/BNB amount for payable fns
  isWrite: boolean;
}

interface GasCost {
  gasLimit: string;
  gasBNB: string;
  gasUSD: string;
  bnbPrice: number;
}

export default function GasEstimate({
  contractAddress,
  abi,
  fn,
  args,
  payableValue,
  isWrite,
}: GasEstimateProps) {
  const [cost, setCost] = useState<GasCost | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Read functions don't cost gas
    if (!isWrite) return;

    // Debounce 600ms
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setIsLoading(true);
      try {
        const rpcUrl = 'https://data-seed-prebsc-1-s1.bnbchain.org:8545/';
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const contract = new ethers.Contract(contractAddress, abi as any, provider);

        const overrides: Record<string, unknown> = {};
        if (fn.stateMutability === 'payable' && payableValue && parseFloat(payableValue) > 0) {
          overrides.value = ethers.parseEther(payableValue);
        }

        const gasLimit = await estimateGas(contract, fn.name, args, overrides);
        if (gasLimit === null) {
          setCost(null);
          return;
        }

        const { gasBNB, gasUSD, bnbPrice } = await calculateCost(gasLimit);
        setCost({
          gasLimit: gasLimit.toString(),
          gasBNB,
          gasUSD,
          bnbPrice,
        });
      } catch {
        setCost(null);
      } finally {
        setIsLoading(false);
      }
    }, 600);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractAddress, fn.name, JSON.stringify(args), payableValue, isWrite]);

  if (!isWrite) return null;
  if (isLoading) return <span className="gas-estimate loading">⛽ Estimating...</span>;
  if (!cost) return null;

  return (
    <span className="gas-estimate" title={`Gas limit: ${cost.gasLimit} | 1 BNB ≈ $${cost.bnbPrice.toFixed(0)}`}>
      ⛽ ~{parseFloat(cost.gasBNB).toFixed(6)} BNB
      <span className="gas-usd">(~${cost.gasUSD})</span>
    </span>
  );
}
