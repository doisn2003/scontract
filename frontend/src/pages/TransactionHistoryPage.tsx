import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import {
  HiOutlineArrowTopRightOnSquare,
  HiOutlineDocumentDuplicate,
  HiOutlineClock,
  HiOutlineCheckCircle,
  HiOutlineXCircle,
  HiOutlineChevronLeft,
  HiOutlineChevronRight,
} from 'react-icons/hi2';
import toast from 'react-hot-toast';
import PageWrapper from '../components/Layout/PageWrapper';
import api from '../services/api';
import type { ApiResponse, Transaction } from '../types';
import './TransactionHistoryPage.css';

interface TransactionWithProject extends Omit<Transaction, 'projectId'> {
  projectId: {
    _id: string;
    name: string;
    network: string;
    contracts: { _id: string; name: string }[];
  } | string;
}

interface PaginatedResult {
  transactions: TransactionWithProject[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

const LIMIT = 15;

function getProjectId(tx: TransactionWithProject): string {
  if (typeof tx.projectId === 'string') return tx.projectId;
  return (tx.projectId as any)?._id || '';
}

function getProjectName(tx: TransactionWithProject): string {
  if (typeof tx.projectId === 'object' && tx.projectId !== null) {
    return tx.projectId.name || 'Unknown Project';
  }
  return 'Unknown Project';
}

function getContractName(tx: TransactionWithProject): string {
  if (!tx.contractId) return '—';
  if (typeof tx.projectId === 'object' && tx.projectId !== null && tx.projectId.contracts) {
    const contract = tx.projectId.contracts.find(c => c._id === tx.contractId);
    return contract?.name || 'Deleted Contract';
  }
  return '—';
}

export default function TransactionHistoryPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [data, setData] = useState<PaginatedResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);

  const fetchTransactions = useCallback(async (p: number) => {
    setIsLoading(true);
    try {
      const { data: resp } = await api.get<ApiResponse<PaginatedResult>>(
        `/transactions?page=${p}&limit=${LIMIT}`
      );
      if (resp.success && resp.data) setData(resp.data);
    } catch {
      toast.error('Failed to load transaction history');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchTransactions(page); }, [fetchTransactions, page]);

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied!`);
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });

  const formatFn = (name: string) =>
    name === '__deploy__' ? '🚀 Deploy Contract' : name;

  return (
    <PageWrapper
      title={t('pages.history.title')}
      subtitle={t('pages.history.subtitle')}
    >
      <div className="tx-history-page">
        {isLoading ? (
          <div className="tx-skeleton-list">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 64, marginBottom: 8 }} />
            ))}
          </div>
        ) : !data || data.transactions.length === 0 ? (
          <div className="tx-empty">
            <HiOutlineClock className="tx-empty-icon" />
            <h3>Chưa có giao dịch nào</h3>
            <p>Hãy Deploy hoặc Interact với Smart Contract để bắt đầu ghi lịch sử.</p>
            <Link to="/projects" className="btn btn-primary" style={{ marginTop: 12 }}>
              Đến trang Projects
            </Link>
          </div>
        ) : (
          <>
            {/* Stats Bar */}
            <div className="tx-stats-bar">
              <span className="tx-stats-item">
                Tổng <strong>{data.pagination.total}</strong> giao dịch
              </span>
              <span className="tx-stats-item">
                Trang <strong>{data.pagination.page}</strong> / {data.pagination.pages}
              </span>
            </div>

            {/* Table */}
            <div className="tx-table-wrap">
              <table className="tx-table">
                <thead>
                  <tr>
                    <th>Thời gian</th>
                    <th>Project</th>
                    <th>Contract</th>
                    <th>Function</th>
                    <th>Tx Hash</th>
                    <th>Gas (BNB)</th>
                    <th>Chi phí (USD)</th>
                    <th>Trạng thái</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {data.transactions.map((tx) => {
                    const projectId = getProjectId(tx);
                    const projectName = getProjectName(tx);
                    const contractName = getContractName(tx);
                    const interactUrl = tx.contractId 
                      ? `/projects/${projectId}/contracts/${tx.contractId}/interact`
                      : `/projects/${projectId}/interact`;

                    return (
                      <tr
                        key={tx._id}
                        className="tx-row"
                        onClick={() => projectId && navigate(interactUrl)}
                        title="Click để đến trang Interact của hợp đồng này"
                      >
                        <td className="tx-cell tx-time">{formatDate(tx.createdAt)}</td>
                        <td className="tx-cell">
                          <span className="tx-project-name">{projectName}</span>
                        </td>
                        <td className="tx-cell">
                          <span className="tx-contract-name">{contractName}</span>
                        </td>
                        <td className="tx-cell">
                          <span className={`tx-fn-name mono ${tx.functionName === '__deploy__' ? 'deploy' : ''}`}>
                            {formatFn(tx.functionName)}
                          </span>
                        </td>
                        <td className="tx-cell tx-hash-cell">
                          <span className="mono tx-hash-short">
                            {tx.txHash.slice(0, 8)}...{tx.txHash.slice(-6)}
                          </span>
                          <button
                            className="copy-btn"
                            onClick={(e) => { e.stopPropagation(); copy(tx.txHash, 'Tx hash'); }}
                            title="Copy full tx hash"
                          >
                            <HiOutlineDocumentDuplicate />
                          </button>
                        </td>
                        <td className="tx-cell tx-number">{parseFloat(tx.gasCostBNB).toFixed(6)}</td>
                        <td className="tx-cell tx-number">${tx.gasCostUSD}</td>
                        <td className="tx-cell">
                          {tx.status === 'success' ? (
                            <span className="badge badge-success tx-status-badge">
                              <HiOutlineCheckCircle /> Success
                            </span>
                          ) : tx.status === 'failed' ? (
                            <span className="badge badge-error tx-status-badge">
                              <HiOutlineXCircle /> Failed
                            </span>
                          ) : (
                            <span className="badge badge-info tx-status-badge">Pending</span>
                          )}
                        </td>
                        <td className="tx-cell tx-actions-cell">
                          <a
                            href={`https://testnet.bscscan.com/tx/${tx.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-ghost btn-sm tx-bscscan-btn"
                            onClick={(e) => e.stopPropagation()}
                            title="View on BscScan"
                          >
                            <HiOutlineArrowTopRightOnSquare /> BscScan
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {data.pagination.pages > 1 && (
              <div className="tx-pagination">
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={page <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                >
                  <HiOutlineChevronLeft /> Prev
                </button>
                <div className="tx-page-numbers">
                  {Array.from({ length: data.pagination.pages }, (_, i) => i + 1)
                    .filter(p => Math.abs(p - page) <= 2)
                    .map(p => (
                      <button
                        key={p}
                        className={`btn btn-ghost btn-sm ${p === page ? 'active' : ''}`}
                        onClick={() => setPage(p)}
                      >
                        {p}
                      </button>
                    ))}
                </div>
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={page >= data.pagination.pages}
                  onClick={() => setPage(p => Math.min(data.pagination.pages, p + 1))}
                >
                  Next <HiOutlineChevronRight />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </PageWrapper>
  );
}
