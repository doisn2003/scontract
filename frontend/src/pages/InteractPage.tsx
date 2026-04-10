import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, Link, Navigate } from 'react-router-dom';
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
  HiOutlineUser
} from 'react-icons/hi2';
import toast from 'react-hot-toast';
import PageWrapper from '../components/Layout/PageWrapper';
import { useMetaMask } from '../hooks/useMetaMask';
import { useAuth } from '../context/AuthContext';
import { parseABI, getTypeHint, parseInputValue } from '../utils/abiParser';
import type { ParsedFunction } from '../utils/abiParser';
import GasEstimate from '../components/Contract/GasEstimate';
import api from '../services/api';
import type { ApiResponse, Project } from '../types';
import './InteractPage.css';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm'; 
import UnauthorizedPage from './UnauthorizedPage';
import ConfigSidebar from '../components/Contract/ConfigSidebar';
import FaucetPanel from '../components/Contract/FaucetPanel';
import { HiOutlineCog6Tooth } from 'react-icons/hi2';

type TabKey = 'read' | 'write' | 'payable';

export default function InteractPage() {
  const { t } = useTranslation();
  const { id, contractId } = useParams<{ id: string; contractId: string }>();
  const mm = useMetaMask();
  const { user } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('read');

  const activeContract = project?.contracts?.find(c => c._id === contractId) || project?.contracts?.[0];
  const contractAddress = activeContract?.contractAddress;
  const abi = activeContract?.abi;

  // Per-function state: inputs, results, loading
  const [inputValues, setInputValues] = useState<Record<string, Record<string, string>>>({});
  const [results, setResults] = useState<Record<string, { value?: string; txHash?: string; error?: string }>>({});
  const [loadingFn, setLoadingFn] = useState<Record<string, boolean>>({});

  const fetchProject = useCallback(async () => {
    if (!id) return;
    try {
      setIsLoading(true);
      const { data } = await api.get<ApiResponse<Project>>(`/projects/${id}`);
      if (data.success && data.data) {
        setProject(data.data);
        setHasAccess(true);
      }
    } catch (err: any) {
      if (err.response?.status === 404 || err.response?.status === 403) {
        setHasAccess(false);
      } else {
        toast.error('Failed to load project');
      }
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchProject(); }, [fetchProject]);

  const parsedAbi = abi ? parseABI(abi) : null;
  const isOwner = user?._id === project?.userId;
  const isGuest = user?.role === 'guest';
  const isSharedDev = project?.shared_devs?.includes(user?._id || '') ?? false;
  const hasConfigAccess = isOwner || isSharedDev;

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const globalConfig = project?.global_access_config || {
    invited_guests: [], allow_all_guests: false, allow_all_devs: false, allow_read: false, allow_write: false, allow_payable: false
  };

  const getPermission = (fnName: string) => {
    return project?.guest_permissions?.find(p => p.contractAddress === contractAddress && p.methodName === fnName);
  };

  const isOverriddenByGlobal = (fn: ParsedFunction) => {
    if (fn.type === 'read' && globalConfig.allow_read) return true;
    if (fn.stateMutability === 'payable' && globalConfig.allow_payable) return true;
    if (fn.type !== 'read' && fn.stateMutability !== 'payable' && globalConfig.allow_write) return true;
    return false;
  };

  // ── 2-Tier Access Model ──
  // Tier 1: Admission ("ticket") — does the user have entry at all?
  // Tier 2: Authorization — which functions can they access?
  const filterFunctions = (funcs: ParsedFunction[]) => {
    // Owners always see everything
    if (isOwner) return funcs;

    // Devs (shared_devs) see everything — they have full owner-like access
    if (isSharedDev) return funcs;

    // Config viewers (non-guest, non-owner, non-sharedDev but somehow here) see all
    if (!isGuest) return funcs;

    // ── Guest path: 2-tier check ──
    // Tier 1: admission
    const hasAdmission =
      globalConfig.allow_all_guests ||
      (globalConfig.invited_guests || []).includes(user?.email || '');

    if (!hasAdmission) return []; // No ticket → no functions

    // Tier 2: function-level authorization
    return funcs.filter(fn => {
      // Check global function-type toggles
      if (isOverriddenByGlobal(fn)) return true;

      // Check per-function permissions (Function Notes tab)
      const p = getPermission(fn.name);
      if (!p) return false;
      if (p.isGlobalAllowed) return true;
      if (p.allowedGuestList?.includes(user?.email || '')) return true;
      return false;
    });
  };

  // Generate tab counts
  const tabCounts: Record<TabKey, number> = {
    read: parsedAbi?.functions.read.length ?? 0,
    write: parsedAbi?.functions.write.length ?? 0,
    payable: parsedAbi?.functions.payable.length ?? 0,
  };

  const getFnSig = (fn: ParsedFunction) => `${fn.name}(${fn.inputs.map(i => i.type).join(',')})`;
  const getInpKey = (inp: {name: string, type: string}, idx: number) => inp.name || `__arg${idx}`;

  // ── Read function (no MetaMask needed) ──
  const handleRead = async (fn: ParsedFunction) => {
    if (!contractAddress || !abi) return;

    const fnSig = getFnSig(fn);
    setLoadingFn(s => ({ ...s, [fnSig]: true }));
    setResults(s => ({ ...s, [fnSig]: {} }));

    try {
      const rpcUrl = 'https://data-seed-prebsc-1-s1.bnbchain.org:8545/';
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const contract = new ethers.Contract(contractAddress, abi as any, provider);

      const args = (fn.inputs || []).map((inp, idx) => {
        const val = inputValues[fnSig]?.[getInpKey(inp, idx)] ?? '';
        return parseInputValue(inp.type, val);
      });

      const result = await contract.getFunction(fnSig)(...args);
      const formatted = typeof result === 'bigint' ? result.toString() : String(result);

      setResults(s => ({ ...s, [fnSig]: { value: formatted } }));
    } catch (err: any) {
      setResults(s => ({ ...s, [fnSig]: { error: err.reason || err.message || String(err) } }));
    } finally {
      setLoadingFn(s => ({ ...s, [fnSig]: false }));
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

    const fnSig = getFnSig(fn);
    setLoadingFn(s => ({ ...s, [fnSig]: true }));
    setResults(s => ({ ...s, [fnSig]: {} }));

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(contractAddress, abi as any, signer);

      const args = (fn.inputs || []).map((inp, idx) => {
        const val = inputValues[fnSig]?.[getInpKey(inp, idx)] ?? '';
        return parseInputValue(inp.type, val);
      });

      // Build overrides
      const overrides: Record<string, any> = {};
      if (fn.stateMutability === 'payable' && payableValue) {
        overrides.value = ethers.parseEther(payableValue);
      }

      const tx = await contract.getFunction(fnSig)(...args, overrides);
      toast.success(`Transaction sent: ${tx.hash.slice(0, 10)}...`);

      setResults(s => ({ ...s, [fnSig]: { txHash: tx.hash } }));

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
          args: (fn.inputs || []).map((inp, idx) => inputValues[fnSig]?.[getInpKey(inp, idx)] ?? ''),
          gasUsed,
        });
      } catch {
        // Non-critical — silently skip
      }
    } catch (err: any) {
      const msg = err.reason || err.message || String(err);
      setResults(s => ({ ...s, [fnSig]: { error: msg } }));
      toast.error(msg.length > 60 ? msg.slice(0, 60) + '...' : msg);
    } finally {
      setLoadingFn(s => ({ ...s, [fnSig]: false }));
    }
  };

  // Input change handler
  const setInput = (fnSig: string, paramName: string, value: string) => {
    setInputValues(s => ({
      ...s,
      [fnSig]: { ...(s[fnSig] || {}), [paramName]: value },
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

  if (!hasAccess) {
    return <UnauthorizedPage />;
  }

  if (!project || project.contracts.length === 0) {
    return <Navigate to="/projects" replace />;
  }

  // If contractId is missing or invalid, redirect to the first one
  if (!contractId && project.contracts.length > 0) {
    return <Navigate to={`/projects/${id}/contracts/${project.contracts[0]._id}/interact`} replace />;
  }

  if (!activeContract || !abi || !contractAddress) {
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

  const renderFunctionCard = (fn: ParsedFunction, isWrite: boolean) => {
    const perm = getPermission(fn.name);
    const fnSig = getFnSig(fn);

    return (
      <div key={fnSig} className="fn-card">
        <div className="fn-card-header">
          <span className="fn-name mono">{fn.name}</span>
          <span className={`badge ${fn.type === 'read' ? 'badge-info' : fn.type === 'payable' ? 'badge-error' : 'badge-warning'}`}>
            {fn.stateMutability}
          </span>
        </div>

        {/* Inputs */}
        {fn.inputs.length > 0 && (
          <div className="fn-inputs">
            {fn.inputs.map((inp, idx) => {
              const inpKey = getInpKey(inp, idx);
              return (
                <div key={inpKey} className="fn-input-row">
                  <label className="fn-input-label">
                    {inp.name || `arg${idx}`} <span className="fn-input-type">({inp.type})</span>
                  </label>
                  <input
                    className="input"
                    placeholder={getTypeHint(inp.type)}
                    value={inputValues[fnSig]?.[inpKey] ?? ''}
                    onChange={(e) => setInput(fnSig, inpKey, e.target.value)}
                  />
                </div>
              );
            })}
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
              value={inputValues[fnSig]?.['__value'] ?? ''}
              onChange={(e) => setInput(fnSig, '__value', e.target.value)}
            />
          </div>
        )}

        {/* Action Button + Gas Estimate */}
        <div className="fn-action-row">
          <button
            className={`btn ${isWrite ? 'btn-primary' : 'btn-secondary'} fn-btn`}
            onClick={() => isWrite
              ? handleWrite(fn, inputValues[fnSig]?.['__value'])
              : handleRead(fn)
            }
            disabled={loadingFn[fnSig]}
          >
            {loadingFn[fnSig] ? (
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
              args={(fn.inputs || []).map((inp, idx) => {
                const val = inputValues[fnSig]?.[getInpKey(inp, idx)] ?? '';
                try { return parseInputValue(inp.type, val); } catch { return val; }
              })}
              payableValue={inputValues[fnSig]?.['__value']}
              isWrite={isWrite}
            />
          )}
        </div>

        {/* Result */}
        {results[fnSig] && (
          <div className={`fn-result ${results[fnSig].error ? 'error' : 'success'}`}>
            {results[fnSig].value !== undefined && (
              <div className="fn-result-value">
                <strong>Result:</strong>
                <span className="mono">{results[fnSig].value}</span>
              </div>
            )}
            {results[fnSig].txHash && (
              <div className="fn-result-tx">
                <strong>Tx Hash:</strong>
                <a
                  href={`https://testnet.bscscan.com/tx/${results[fnSig].txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mono"
                >
                  {results[fnSig].txHash!.slice(0, 14)}...
                  <HiOutlineArrowTopRightOnSquare />
                </a>
                <button
                  className="copy-btn"
                  onClick={() => {
                    navigator.clipboard.writeText(results[fnSig].txHash!);
                    toast.success('Tx hash copied!');
                  }}
                >
                  <HiOutlineDocumentDuplicate />
                </button>
              </div>
            )}
            {results[fnSig].error && (
              <div className="fn-result-error">
                <HiOutlineExclamationTriangle /> {results[fnSig].error}
              </div>
            )}
          </div>
        )}

        {/* Markdown Note (Visible to everyone if exists) */}
        {perm?.note && (
          <div className="fn-markdown-preview" style={{ padding: '1rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', marginTop: '0.75rem', fontSize: '0.9rem' }}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{perm.note}</ReactMarkdown>
          </div>
        )}
      </div>
    )
  };


  const currentFunctions = filterFunctions(parsedAbi?.functions[activeTab] ?? []);

  return (
    <PageWrapper
      title={`${t('nav.interact')}: ${activeContract.name}`}
      subtitle={`${contractAddress.slice(0, 10)}...${contractAddress.slice(-6)} ${t('pages.dashboard.stats.network')} ${project.network}`}
    >
      <div className={`interact-page ${hasConfigAccess ? 'has-sidebar' : ''}`}>
        <div className="interact-workspace">
          {/* LEFT: MAIN CONTENT */}
          <div className="interact-main">
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

            {/* Faucet Panel */}
            {activeContract && (hasConfigAccess || activeContract.faucetConfig?.isEnabled) && (
              <FaucetPanel 
                projectId={id!}
                contract={activeContract}
                isDevConfig={hasConfigAccess}
                onUpdate={fetchProject}
                devAddress={typeof project.walletId === 'object' ? project.walletId.address : project.walletId}
              />
            )}

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

          {/* RIGHT: CONFIG SIDEBAR (Admin/Shared Dev Only) */}
          {hasConfigAccess && isSidebarOpen && (
            <ConfigSidebar
              projectId={id!}
              project={project}
              contractAddress={contractAddress}
              parsedAbi={parsedAbi}
              currentFunctions={currentFunctions}
              onProjectUpdate={setProject}
              onClose={() => setIsSidebarOpen(false)}
            />
          )}

          {hasConfigAccess && !isSidebarOpen && (
            <div style={{ flex: '0 0 auto', marginTop: '1.5rem' }}>
              <button 
                className="btn btn-secondary"
                onClick={() => setIsSidebarOpen(true)}
                style={{ position: 'sticky', top: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <HiOutlineCog6Tooth size={20} />
                {t('pages.interact.config.global')}
              </button>
            </div>
          )}
        </div>
      </div>
    </PageWrapper>
  );
}
