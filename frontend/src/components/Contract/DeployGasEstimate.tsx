/**
 * DeployGasEstimate.tsx
 * Hiển thị ước tính phí gas trước khi deploy contract lên BSC Testnet.
 * Gọi endpoint GET /api/projects/:id/estimate-deploy khi project ở trạng thái compiled.
 * Kết quả hiển thị dạng info box: gasLimit, BNB cost, USD equivalent, và địa chỉ ví deployer.
 */

import { useState, useEffect } from 'react';
import {
  HiOutlineBeaker,
  HiOutlineArrowPath,
  HiOutlineExclamationTriangle,
} from 'react-icons/hi2';
import api from '../../services/api';
import type { ApiResponse } from '../../types';
import './DeployGasEstimate.css';

interface DeployGasEstimateProps {
  projectId: string;
  contractId: string;
}

interface GasEstimateResult {
  gasLimit: string;
  gasBNB: string;
  gasUSD: string;
  bnbPrice: number;
  deployerAddress: string;
}

export default function DeployGasEstimate({ projectId, contractId }: DeployGasEstimateProps) {
  const [result, setResult] = useState<GasEstimateResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEstimate = async () => {
    if (!projectId || !contractId) return;
    setIsLoading(true);
    setError(null);
    try {
      const { data } = await api.get<ApiResponse<GasEstimateResult>>(
        `/projects/${projectId}/contracts/${contractId}/estimate-deploy`
      );
      if (data.success && data.data) {
        setResult(data.data);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Could not estimate gas';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-fetch on mount
  useEffect(() => {
    fetchEstimate();
  }, [projectId]);

  if (isLoading) {
    return (
      <div className="deploy-gas-box loading">
        <span className="spinner" style={{ width: 16, height: 16 }} />
        <span>Đang tính phí gas ước tính...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="deploy-gas-box error">
        <HiOutlineExclamationTriangle className="deploy-gas-icon" />
        <div className="deploy-gas-content">
          <span className="deploy-gas-title">Không thể ước tính phí</span>
          <span className="deploy-gas-detail">{error}</span>
        </div>
        <button className="deploy-gas-refresh btn-ghost btn-sm" onClick={fetchEstimate}>
          <HiOutlineArrowPath />
        </button>
      </div>
    );
  }

  if (!result) return null;

  const shortAddr = `${result.deployerAddress.slice(0, 8)}...${result.deployerAddress.slice(-6)}`;

  return (
    <div className="deploy-gas-box">
      <HiOutlineBeaker className="deploy-gas-icon" />
      <div className="deploy-gas-content">
        <span className="deploy-gas-title">Phí Gas ước tính</span>
        <div className="deploy-gas-values">
          <span className="deploy-gas-bnb">
            ~{parseFloat(result.gasBNB).toFixed(6)} BNB
          </span>
          <span className="deploy-gas-sep">≈</span>
          <span className="deploy-gas-usd">${result.gasUSD}</span>
          <span className="deploy-gas-sep">·</span>
          <span className="deploy-gas-limit" title={`Gas limit: ${result.gasLimit}`}>
            {Number(result.gasLimit).toLocaleString()} gas
          </span>
        </div>
        <span className="deploy-gas-deployer" title={result.deployerAddress}>
          Deployer: <span className="mono">{shortAddr}</span>
          &nbsp;·&nbsp; 1 BNB ≈ ${result.bnbPrice.toFixed(0)}
        </span>
      </div>
      <button
        className="deploy-gas-refresh"
        onClick={fetchEstimate}
        title="Tính lại"
      >
        <HiOutlineArrowPath />
      </button>
    </div>
  );
}
