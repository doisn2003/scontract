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
  HiOutlineUser,
  HiOutlineUsers,
  HiOutlineCommandLine,
  HiOutlineShieldCheck,
  HiOutlineXMark
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
  const isSharedDev = project?.shared_devs?.includes(user?._id || '');
  const hasConfigAccess = isOwner || isSharedDev;

  const [savingPerm, setSavingPerm] = useState<string | null>(null);
  const [configTab, setConfigTab] = useState<'global' | 'notes'>('global');
  const [guestInviteEmail, setGuestInviteEmail] = useState('');
  const [devInviteEmail, setDevInviteEmail] = useState('');
  const [revokeConfirm, setRevokeConfirm] = useState<{ type: 'guests' | 'devs' } | null>(null);

  const globalConfig = project?.global_access_config || {
    invited_guests: [], allow_all_guests: false, allow_all_devs: false, allow_read: false, allow_write: false, allow_payable: false
  };

  const handleUpdateGlobalConfig = async (updates: Partial<typeof globalConfig>, extraPatch?: Record<string, any>) => {
    if (!id || !project) return;
    const newConfig = { ...globalConfig, ...updates };
    try {
      const res = await api.patch(`/projects/${id}`, { global_access_config: newConfig, ...extraPatch });
      if (res.data?.success) setProject(res.data.data);
    } catch {
      toast.error('Failed to update config');
    }
  };

  // Handle toggling allow_all_guests with revoke confirmation
  const handleToggleAllowAllGuests = (checked: boolean) => {
    if (checked) {
      // Turning ON — just enable
      handleUpdateGlobalConfig({ allow_all_guests: true });
    } else {
      // Turning OFF — show confirmation (will purge invited_guests)
      setRevokeConfirm({ type: 'guests' });
    }
  };

  // Handle toggling allow_all_devs with revoke confirmation
  const handleToggleAllowAllDevs = (checked: boolean) => {
    if (checked) {
      handleUpdateGlobalConfig({ allow_all_devs: true });
    } else {
      setRevokeConfirm({ type: 'devs' });
    }
  };

  // Confirm revoke action
  const handleConfirmRevoke = async () => {
    if (!revokeConfirm || !id) return;
    if (revokeConfirm.type === 'guests') {
      await handleUpdateGlobalConfig(
        { allow_all_guests: false, invited_guests: [] }
      );
      toast.success(t('pages.interact.config.all_revoked_guests'));
    } else {
      await handleUpdateGlobalConfig(
        { allow_all_devs: false },
        { clear_shared_devs: true }
      );
      toast.success(t('pages.interact.config.all_revoked_devs'));
    }
    setRevokeConfirm(null);
  };

  // Remove a single invited guest
  const handleRemoveGuest = async (email: string) => {
    if (!id) return;
    try {
      const res = await api.patch(`/projects/${id}`, { remove_invited_guest: email });
      if (res.data?.success) {
        setProject(res.data.data);
        toast.success(`Removed ${email}`);
      }
    } catch {
      toast.error('Failed to remove guest');
    }
  };

  // Remove a single shared dev
  const handleRemoveDev = async (devId: string) => {
    if (!id) return;
    try {
      const res = await api.patch(`/projects/${id}`, { remove_shared_dev_id: devId });
      if (res.data?.success) {
        setProject(res.data.data);
        toast.success('Developer removed');
      }
    } catch {
      toast.error('Failed to remove developer');
    }
  };

  const handleInviteDev = async () => {
    if (!id || !devInviteEmail) return;
    try {
      const res = await api.patch(`/projects/${id}`, { add_shared_dev_email: devInviteEmail });
      if (res.data?.success) {
        setProject(res.data.data);
        setDevInviteEmail('');
        toast.success('Developer invited');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to invite developer');
    }
  };

  const handleInviteGuest = () => {
    if (!guestInviteEmail) return;
    const currentList = globalConfig.invited_guests || [];
    if (!currentList.includes(guestInviteEmail)) {
      handleUpdateGlobalConfig({ invited_guests: [...currentList, guestInviteEmail] });
      setGuestInviteEmail('');
      toast.success('Guest invited');
    }
  };

  const getPermission = (fnName: string) => {
    return project?.guest_permissions?.find(p => p.contractAddress === contractAddress && p.methodName === fnName);
  };

  const handleUpdatePermission = async (fnName: string, isGlobalAllowed: boolean, guestEmails: string, noteStr?: string) => {
    if (!id || !project || !contractAddress) return;
    setSavingPerm(fnName);
    try {
      const allowedGuestList = guestEmails.split(',').map(e => e.trim()).filter(e => e);
      let newPerms = project.guest_permissions ? [...project.guest_permissions] : [];
      const index = newPerms.findIndex(p => p.contractAddress === contractAddress && p.methodName === fnName);

      const updatedPerm = {
        contractAddress,
        methodName: fnName,
        isGlobalAllowed,
        allowedGuestList,
        note: noteStr !== undefined ? noteStr : (getPermission(fnName)?.note || '')
      };

      if (index >= 0) {
        newPerms[index] = updatedPerm;
      } else {
        newPerms.push(updatedPerm);
      }

      const res = await api.patch(`/projects/${id}`, { guest_permissions: newPerms });
      if (res.data?.success) {
        setProject(res.data.data);
      }
    } catch {
      toast.error('Failed to update permissions');
    } finally {
      setSavingPerm(null);
    }
  };

  const isOverriddenByGlobal = (fn: ParsedFunction) => {
    if (fn.type === 'read' && globalConfig.allow_read) return true;
    if (fn.stateMutability === 'payable' && globalConfig.allow_payable) return true;
    if (fn.type !== 'read' && fn.stateMutability !== 'payable' && globalConfig.allow_write) return true;
    return false;
  };

  // Destructive toggle for Guest Function Access:
  // ON  → just enable the global toggle
  // OFF → disable the toggle AND clear all per-function isGlobalAllowed for that function type
  const handleToggleGlobalAccess = async (
    configKey: 'allow_read' | 'allow_write' | 'allow_payable',
    fnType: 'read' | 'write' | 'payable',
    checked: boolean
  ) => {
    if (checked) {
      // Turning ON — just enable
      handleUpdateGlobalConfig({ [configKey]: true });
    } else {
      // Turning OFF — also reset per-function permissions for this type
      if (!project || !contractAddress || !parsedAbi) {
        handleUpdateGlobalConfig({ [configKey]: false });
        return;
      }

      // Find all functions of this type
      const fnsOfType = parsedAbi.functions[fnType] || [];
      const fnNames = fnsOfType.map(fn => fn.name);

      // Clear isGlobalAllowed for matching per-function permissions
      const newPerms = (project.guest_permissions || []).map(p => {
        if (p.contractAddress === contractAddress && fnNames.includes(p.methodName)) {
          return { ...p, isGlobalAllowed: false, allowedGuestList: [] };
        }
        return p;
      });

      // Update both global config and per-function permissions in one call
      const newConfig = { ...globalConfig, [configKey]: false };
      try {
        const res = await api.patch(`/projects/${id}`, {
          global_access_config: newConfig,
          guest_permissions: newPerms
        });
        if (res.data?.success) setProject(res.data.data);
      } catch {
        toast.error('Failed to update config');
      }
    }
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

    return (
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

  const renderToggle = (checked: boolean, onChange: (c: boolean) => void) => (
    <label className="toggle-switch">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-slider"></span>
    </label>
  );

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

          {/* Revoke Confirmation Modal */}
          {revokeConfirm && (
            <div className="modal-overlay" onClick={() => setRevokeConfirm(null)}>
              <div className="modal-content revoke-modal" onClick={e => e.stopPropagation()}>
                <div className="revoke-modal-icon">
                  <HiOutlineExclamationTriangle size={32} />
                </div>
                <h3 className="revoke-modal-title">
                  {revokeConfirm.type === 'guests'
                    ? t('pages.interact.config.revoke_all_guests_title')
                    : t('pages.interact.config.revoke_all_devs_title')}
                </h3>
                <p className="revoke-modal-msg">
                  {revokeConfirm.type === 'guests'
                    ? t('pages.interact.config.revoke_all_guests_msg')
                    : t('pages.interact.config.revoke_all_devs_msg')}
                </p>
                <div className="revoke-modal-actions">
                  <button className="btn btn-ghost" onClick={() => setRevokeConfirm(null)}>
                    {t('pages.interact.config.cancel_revoke')}
                  </button>
                  <button className="btn btn-danger" onClick={handleConfirmRevoke}>
                    {t('pages.interact.config.confirm_revoke')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* RIGHT: CONFIG SIDEBAR (Admin/Shared Dev Only) */}
          {hasConfigAccess && (
            <div className="interact-sidebar">
              <div className="config-tabs-header">
                <button
                  className={`config-tab-btn ${configTab === 'global' ? 'active' : ''}`}
                  onClick={() => setConfigTab('global')}
                >
                  {t('pages.interact.config.global')}
                </button>
                <button
                  className={`config-tab-btn ${configTab === 'notes' ? 'active' : ''}`}
                  onClick={() => setConfigTab('notes')}
                >
                  {t('pages.interact.config.notes')}
                </button>
              </div>

              <div className="config-panel">
                {configTab === 'global' && (
                  <>
                    {/* ═══ SECTION 1: Guest Admission (Ticket) ═══ */}
                    <div className="config-group">
                      <div className="config-section-title">
                        <HiOutlineUsers size={16} /> {t('pages.interact.config.admission_guests')}
                      </div>
                      <div className="config-section-desc">{t('pages.interact.config.admission_guests_desc')}</div>

                      <div className="config-input-group">
                        <input
                          className="input"
                          placeholder={t('pages.interact.config.email_placeholder')}
                          value={guestInviteEmail}
                          onChange={e => setGuestInviteEmail(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleInviteGuest()}
                        />
                        <button className="btn btn-primary btn-sm" onClick={handleInviteGuest}>{t('pages.interact.config.btn_invite')}</button>
                      </div>

                      {/* Invited Guest List */}
                      {(globalConfig.invited_guests || []).length > 0 && (
                        <div className="invited-list">
                          {globalConfig.invited_guests.map((email: string) => (
                            <div key={email} className="invited-chip">
                              <span className="invited-chip-email">{email}</span>
                              <button className="invited-chip-remove" onClick={() => handleRemoveGuest(email)} title={t('pages.interact.config.remove')}>
                                <HiOutlineXMark size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="config-toggle-row" style={{ padding: '8px 0 0', border: 'none' }}>
                        <div className="config-toggle-info">
                          <span className="config-toggle-label" style={{ fontSize: '13px' }}>{t('pages.interact.config.allow_all')}</span>
                        </div>
                        {renderToggle(globalConfig.allow_all_guests, handleToggleAllowAllGuests)}
                      </div>
                    </div>

                    {/* ═══ SECTION 2: Dev Admission (Ticket) ═══ */}
                    <div className="config-group">
                      <div className="config-section-title">
                        <HiOutlineCommandLine size={16} /> {t('pages.interact.config.admission_devs')}
                      </div>
                      <div className="config-section-desc">{t('pages.interact.config.admission_devs_desc')}</div>

                      <div className="config-input-group">
                        <input
                          className="input"
                          placeholder={t('pages.interact.config.dev_email_placeholder')}
                          value={devInviteEmail}
                          onChange={e => setDevInviteEmail(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleInviteDev()}
                        />
                        <button className="btn btn-secondary btn-sm" onClick={handleInviteDev}>
                          {t('pages.interact.config.btn_invite')}
                        </button>
                      </div>

                      {/* Shared Dev List */}
                      {(project?.shared_devs || []).length > 0 && (
                        <div className="invited-list">
                          {project!.shared_devs.map((devId: string) => (
                            <div key={devId} className="invited-chip invited-chip--dev">
                              <span className="invited-chip-email">{devId}</span>
                              <button className="invited-chip-remove" onClick={() => handleRemoveDev(devId)} title={t('pages.interact.config.remove')}>
                                <HiOutlineXMark size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="config-toggle-row" style={{ padding: '8px 0 0', border: 'none' }}>
                        <div className="config-toggle-info">
                          <span className="config-toggle-label" style={{ fontSize: '13px' }}>{t('pages.interact.config.allow_all')}</span>
                        </div>
                        {renderToggle(globalConfig.allow_all_devs, handleToggleAllowAllDevs)}
                      </div>
                    </div>

                    {/* ═══ SECTION 3: Global Access (Authorization) ═══ */}
                    <div className="config-group highlight">
                      <div className="config-section-title">
                        <HiOutlineShieldCheck size={16} /> {t('pages.interact.config.global_access')}
                      </div>
                      <div className="config-section-desc">{t('pages.interact.config.global_access_desc')}</div>
                      
                      <div className="config-toggle-row">
                        <div className="config-toggle-info">
                          <span className="config-toggle-label">{t('pages.interact.config.read_access')}</span>
                          <span className="config-toggle-desc">{t('pages.interact.config.read_desc')}</span>
                        </div>
                        {renderToggle(globalConfig.allow_read, (checked) => handleToggleGlobalAccess('allow_read', 'read', checked))}
                      </div>

                      <div className="config-toggle-row">
                        <div className="config-toggle-info">
                          <span className="config-toggle-label">{t('pages.interact.config.write_access')}</span>
                          <span className="config-toggle-desc">{t('pages.interact.config.write_desc')}</span>
                        </div>
                        {renderToggle(globalConfig.allow_write, (checked) => handleToggleGlobalAccess('allow_write', 'write', checked))}
                      </div>

                      <div className="config-toggle-row">
                        <div className="config-toggle-info">
                          <span className="config-toggle-label">{t('pages.interact.config.payable_access')}</span>
                          <span className="config-toggle-desc">{t('pages.interact.config.payable_desc')}</span>
                        </div>
                        {renderToggle(globalConfig.allow_payable, (checked) => handleToggleGlobalAccess('allow_payable', 'payable', checked))}
                      </div>
                    </div>
                  </>
                )}

                {configTab === 'notes' && (
                  <div className="fn-notes-list">
                    {currentFunctions.length === 0 && (
                      <div className="fn-empty">Select a category with functions to take notes.</div>
                    )}
                    {currentFunctions.map(fn => {
                      const perm = getPermission(fn.name);
                      const isOverridden = isOverriddenByGlobal(fn);
                      return (
                        <div key={fn.name} className="fn-note-card">
                          <div className="fn-note-header">{fn.name}</div>

                          {isOverridden ? (
                            <div style={{ fontSize: '12px', color: 'var(--color-accent)', padding: '0.25rem 0' }}>
                              ⚡ Inheriting from Global Access Control
                            </div>
                          ) : (
                            <div className="config-toggle-row" style={{ padding: 0, border: 'none' }}>
                              <div className="config-toggle-info">
                                <span className="config-toggle-label" style={{ fontSize: '13px' }}>{t('pages.interact.config.allow_fn')}</span>
                              </div>
                              {renderToggle(perm?.isGlobalAllowed || false, (checked) => {
                                handleUpdatePermission(fn.name, checked, '', perm?.note);
                              })}
                            </div>
                          )}

                          <textarea
                            className="fn-note-textarea"
                            placeholder={t('pages.interact.config.notes_placeholder')}
                            defaultValue={perm?.note || ''}
                            onBlur={(e) => handleUpdatePermission(fn.name, perm?.isGlobalAllowed || false, '', e.target.value)}
                          ></textarea>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </PageWrapper>
  );
}
