import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, Link } from 'react-router-dom';
import { ethers } from 'ethers';
import {
  HiOutlineArrowPath,
  HiOutlineDocumentDuplicate,
  HiOutlineArrowTopRightOnSquare,
  HiOutlineExclamationTriangle,
  HiOutlinePlay,
  HiOutlineCodeBracket,
  HiOutlineEye,
  HiOutlinePencilSquare,
  HiOutlineCurrencyDollar,
  HiOutlineUser,
} from 'react-icons/hi2';
import toast from 'react-hot-toast';
import PageWrapper from '../components/Layout/PageWrapper';
import { useMetaMask } from '../hooks/useMetaMask';
import { parseABI, getTypeHint, parseInputValue } from '../utils/abiParser';
import type { ParsedFunction } from '../utils/abiParser';
import GasEstimate from '../components/Contract/GasEstimate';
import api from '../services/api';
import type { ApiResponse, Project } from '../types';
import './InteractPage.css';



type TabKey = 'read' | 'write' | 'payable';

export default function InteractPage() {
  const { t } = useTranslation();
  const { id, contractId } = useParams<{ id: string; contractId: string }>();
  const mm = useMetaMask();
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('read');

  const activeContract = project?.contracts?.find(c => c._id === contractId);
  const contractAddress = activeContract?.contractAddress;
  const abi = activeContract?.abi;

  // Per-function state: inputs, results, loading
  const [inputValues, setInputValues] = useState<Record<string, Record<string, string>>>({});
  const [results, setResults] = useState<Record<string, { value?: string; txHash?: string; error?: string }>>({});
  const [loadingFn, setLoadingFn] = useState<Record<string, boolean>>({});

  const fetchProject = useCallback(async () => {
    if (!id) return;
    try {
      const { data } = await api.get<ApiResponse<Project>>(`/projects/${id}`);
      if (data.success && data.data) setProject(data.data);
    } catch {
      toast.error('Failed to load project');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchProject(); }, [fetchProject]);

  const parsedAbi = abi ? parseABI(abi) : null;

  // Generate tab counts
  const tabCounts: Record<TabKey, number> = {
    read: parsedAbi?.functions.read.length ?? 0,
    write: parsedAbi?.functions.write.length ?? 0,
    payable: parsedAbi?.functions.payable.length ?? 0,
  };

  // ── Read function (no MetaMask needed) ──
  const handleRead = async (fn: ParsedFunction) => {
    if (!contractAddress || !abi) return;

    setLoadingFn(s => ({ ...s, [fn.name]: true }));
    setResults(s => ({ ...s, [fn.name]: {} }));

    try {
      const rpcUrl = 'https://data-seed-prebsc-1-s1.bnbchain.org:8545/';
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const contract = new ethers.Contract(contractAddress, abi as any, provider);

      const args = (fn.inputs || []).map(inp => {
        const val = inputValues[fn.name]?.[inp.name] ?? '';
        return parseInputValue(inp.type, val);
      });

      const result = await contract[fn.name](...args);
      const formatted = typeof result === 'bigint' ? result.toString() : String(result);

      setResults(s => ({ ...s, [fn.name]: { value: formatted } }));
    } catch (err: any) {
      setResults(s => ({ ...s, [fn.name]: { error: err.reason || err.message || String(err) } }));
    } finally {
      setLoadingFn(s => ({ ...s, [fn.name]: false }));
    }
  };

  // ── Write function (needs MetaMask) ──
  const handleWrite = async (fn: ParsedFunction, payableValue?: string) => {
    if (!contractAddress || !abi) return;
    if (!mm.isConnected) {
      toast.error('Please connect MetaMask first');
      mm.connectWallet();
      return;
    }
    if (!mm.isCorrectNetwork) {
      toast.error('Please switch to BSC Testnet');
      mm.switchToBscTestnet();
      return;
    }

    setLoadingFn(s => ({ ...s, [fn.name]: true }));
    setResults(s => ({ ...s, [fn.name]: {} }));

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(contractAddress, abi as any, signer);

      const args = (fn.inputs || []).map(inp => {
        const val = inputValues[fn.name]?.[inp.name] ?? '';
        return parseInputValue(inp.type, val);
      });

      // Build overrides
      const overrides: Record<string, any> = {};
      if (fn.stateMutability === 'payable' && payableValue) {
        overrides.value = ethers.parseEther(payableValue);
      }

      const tx = await contract[fn.name](...args, overrides);
      toast.success(`Transaction sent: ${tx.hash.slice(0, 10)}...`);

      setResults(s => ({ ...s, [fn.name]: { txHash: tx.hash } }));

      // Wait for confirmation
      const receipt = await tx.wait();
      toast.success(`Transaction confirmed!`);

      // Record transaction in history (fire-and-forget)
      try {
        const gasUsed = receipt?.gasUsed ? Number(receipt.gasUsed) : 0;
        await api.post('/transactions', {
          projectId: id,
          contractId,
          txHash: tx.hash,
          functionName: fn.name,
          args: (fn.inputs || []).map(inp => inputValues[fn.name]?.[inp.name] ?? ''),
          gasUsed,
        });
      } catch {
        // Non-critical — silently skip
      }
    } catch (err: any) {
      const msg = err.reason || err.message || String(err);
      setResults(s => ({ ...s, [fn.name]: { error: msg } }));
      toast.error(msg.length > 60 ? msg.slice(0, 60) + '...' : msg);
    } finally {
      setLoadingFn(s => ({ ...s, [fn.name]: false }));
    }
  };

  // Input change handler
  const setInput = (fnName: string, paramName: string, value: string) => {
    setInputValues(s => ({
      ...s,
      [fnName]: { ...s[fnName], [paramName]: value },
    }));
  };

  // ── Render ──

  if (isLoading) {
    return (
      <PageWrapper title="Contract Interaction">
        <div className="skeleton" style={{ height: 200 }} />
      </PageWrapper>
    );
  }

  if (!project || !activeContract || !abi || !contractAddress) {
    return (
      <PageWrapper title="Not Available">
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-16)' }}>
          <HiOutlineExclamationTriangle style={{ fontSize: '2rem', color: 'var(--color-warning)', marginBottom: 12 }} />
          <h3>Contract not deployed</h3>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: 16 }}>
            This contract must be compiled and deployed before you can interact with it.
          </p>
          <Link to={`/projects/${id}`} className="btn btn-primary">Back to Project</Link>
        </div>
      </PageWrapper>
    );
  }

  // Network warning
  const networkWarning = mm.isConnected && !mm.isCorrectNetwork;

  const renderFunctionCard = (fn: ParsedFunction, isWrite: boolean) => (
    <div key={fn.name} className="fn-card">
      <div className="fn-card-header">
        <span className="fn-name mono">{fn.name}</span>
        <span className={`badge ${fn.type === 'read' ? 'badge-info' : fn.type === 'payable' ? 'badge-error' : 'badge-warning'}`}>
          {fn.stateMutability}
        </span>
      </div>

      {/* Inputs */}
      {fn.inputs.length > 0 && (
        <div className="fn-inputs">
          {fn.inputs.map(inp => (
            <div key={inp.name} className="fn-input-row">
              <label className="fn-input-label">
                {inp.name} <span className="fn-input-type">({inp.type})</span>
              </label>
              <input
                className="input"
                placeholder={getTypeHint(inp.type)}
                value={inputValues[fn.name]?.[inp.name] ?? ''}
                onChange={(e) => setInput(fn.name, inp.name, e.target.value)}
              />
            </div>
          ))}
        </div>
      )}

      {/* Payable value input */}
      {fn.stateMutability === 'payable' && (
        <div className="fn-input-row">
          <label className="fn-input-label">
            Value <span className="fn-input-type">(BNB)</span>
          </label>
          <input
            className="input"
            placeholder="0.01"
            value={inputValues[fn.name]?.['__value'] ?? ''}
            onChange={(e) => setInput(fn.name, '__value', e.target.value)}
          />
        </div>
      )}

      {/* Action Button + Gas Estimate */}
      <div className="fn-action-row">
        <button
          className={`btn ${isWrite ? 'btn-primary' : 'btn-secondary'} fn-btn`}
          onClick={() => isWrite
            ? handleWrite(fn, inputValues[fn.name]?.['__value'])
            : handleRead(fn)
          }
          disabled={loadingFn[fn.name]}
        >
          {loadingFn[fn.name] ? (
            <><span className="spinner" style={{ width: 14, height: 14 }} /> Processing...</>
          ) : isWrite ? (
            <><HiOutlinePlay /> Execute</>
          ) : (
            <><HiOutlineArrowPath /> Query</>
          )}
        </button>
        {isWrite && contractAddress && abi && (
          <GasEstimate
            contractAddress={contractAddress}
            abi={abi as unknown[]}
            fn={fn}
            args={(fn.inputs || []).map(inp => {
              const val = inputValues[fn.name]?.[inp.name] ?? '';
              try { return parseInputValue(inp.type, val); } catch { return val; }
            })}
            payableValue={inputValues[fn.name]?.['__value']}
            isWrite={isWrite}
          />
        )}
      </div>

      {/* Result */}
      {results[fn.name] && (
        <div className={`fn-result ${results[fn.name].error ? 'error' : 'success'}`}>
          {results[fn.name].value !== undefined && (
            <div className="fn-result-value">
              <strong>Result:</strong>
              <span className="mono">{results[fn.name].value}</span>
            </div>
          )}
          {results[fn.name].txHash && (
            <div className="fn-result-tx">
              <strong>Tx Hash:</strong>
              <a
                href={`https://testnet.bscscan.com/tx/${results[fn.name].txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mono"
              >
                {results[fn.name].txHash!.slice(0, 14)}...
                <HiOutlineArrowTopRightOnSquare />
              </a>
              <button
                className="copy-btn"
                onClick={() => {
                  navigator.clipboard.writeText(results[fn.name].txHash!);
                  toast.success('Tx hash copied!');
                }}
              >
                <HiOutlineDocumentDuplicate />
              </button>
            </div>
          )}
          {results[fn.name].error && (
            <div className="fn-result-error">
              <HiOutlineExclamationTriangle /> {results[fn.name].error}
            </div>
          )}
        </div>
      )}
    </div>
  );

  const currentFunctions = parsedAbi?.functions[activeTab] ?? [];

  return (
    <PageWrapper
      title={`${t('nav.interact')}: ${activeContract.name}`}
      subtitle={`${contractAddress.slice(0, 10)}...${contractAddress.slice(-6)} ${t('pages.dashboard.stats.network')} ${project.network}`}
    >
      <div className="interact-page">
        {/* Network Warning */}
        {networkWarning && (
          <div className="network-warning">
            <HiOutlineExclamationTriangle />
            <span>You are on the wrong network. Write functions require BSC Testnet (Chain ID 97).</span>
            <button className="btn btn-sm btn-primary" onClick={mm.switchToBscTestnet}>
              Switch Network
            </button>
          </div>
        )}

        {/* Contract Info Bar */}
        <div className="contract-info-bar">
          <div className="contract-info-rows">
            <div className="contract-info-item">
              <HiOutlineCodeBracket />
              <span className="info-label">Contract Address:</span>
              <div className="info-value">
                <span className="mono">{contractAddress}</span>
                <button
                  className="copy-btn"
                  onClick={() => {
                    navigator.clipboard.writeText(contractAddress!);
                    toast.success('Address copied!');
                  }}
                  title="Copy Address"
                >
                  <HiOutlineDocumentDuplicate />
                </button>
              </div>
            </div>
            <div className="contract-info-item">
              <HiOutlineUser />
              <span className="info-label">Owner:</span>
              <div className="info-value">
                <span className="mono">
                  {typeof project.walletId === 'object' ? project.walletId.address : project.walletId}
                </span>
                <button
                  className="copy-btn"
                  onClick={() => {
                    const addr = typeof project.walletId === 'object' ? project.walletId.address : project.walletId;
                    navigator.clipboard.writeText(addr);
                    toast.success('Owner address copied!');
                  }}
                  title="Copy Owner"
                >
                  <HiOutlineDocumentDuplicate />
                </button>
              </div>
            </div>
          </div>
          <a
            href={`https://testnet.bscscan.com/address/${contractAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost btn-sm"
          >
            <HiOutlineArrowTopRightOnSquare /> BscScan
          </a>
        </div>

        {/* Tabs */}
        <div className="interact-tabs">
          {(['read', 'write', 'payable'] as TabKey[]).map(tab => (
            <button
              key={tab}
              className={`interact-tab ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'read' ? (
                <><HiOutlineEye size={18} /> {t('pages.interact.tabs.read')}</>
              ) : tab === 'write' ? (
                <><HiOutlinePencilSquare size={18} /> {t('pages.interact.tabs.write')}</>
              ) : (
                <><HiOutlineCurrencyDollar size={18} /> {t('pages.interact.tabs.payable')}</>
              )}
              <span className="tab-count">{tabCounts[tab]}</span>
            </button> 
          ))}
        </div>

        {/* Function Cards */}
        <div className="fn-grid">
          {currentFunctions.length === 0 ? (
            <div className="fn-empty">
              No {activeTab} functions found in this contract.
            </div>
          ) : (
            currentFunctions.map(fn => renderFunctionCard(fn, activeTab !== 'read'))
          )}
        </div>
      </div>
    </PageWrapper>
  );
}
