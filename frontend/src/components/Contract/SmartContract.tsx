import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  HiOutlineCodeBracket,
  HiOutlineRocketLaunch,
  HiOutlineDocumentDuplicate,
  HiOutlineArrowTopRightOnSquare,
  HiOutlineChevronDown,
  HiOutlineChevronRight,
  HiOutlineExclamationTriangle,
  HiOutlineCpuChip,
  HiOutlineArrowDownTray,
  HiOutlineCheck,
} from 'react-icons/hi2';
import toast from 'react-hot-toast';
import { ethers } from 'ethers';
import api from '../../services/api';
import type { ApiResponse, Project, SmartContract as ISmartContract, AbiItem, AbiInput } from '../../types';
import DeployGasEstimate from './DeployGasEstimate';
import './SmartContract.css';

interface SmartContractProps {
  projectId: string;
  contract: ISmartContract;
  isOwner: boolean;
  walletAddress?: string;
  onUpdate: () => void;
  network: string;
}

export default function SmartContract({ 
  projectId, 
  contract, 
  isOwner, 
  walletAddress,
  onUpdate,
  network 
}: SmartContractProps) {
  const [isCompiling, setIsCompiling] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [compileError, setCompileError] = useState('');
  const [deployError, setDeployError] = useState('');
  const [showSource, setShowSource] = useState(false);
  const [showAbi, setShowAbi] = useState(false);
  const [compileErrorDetails, setCompileErrorDetails] = useState('');
  const [deployErrorDetails, setDeployErrorDetails] = useState('');
  const [constructorParams, setConstructorParams] = useState<AbiInput[]>([]);
  const [constructorArgs, setConstructorArgs] = useState<Record<string, string>>({});
  const [showArgErrors, setShowArgErrors] = useState(false);
  const [sourceCode, setSourceCode] = useState(contract.soliditySource);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setSourceCode(contract.soliditySource);
  }, [contract.soliditySource]);

  // Extract constructor params
  useEffect(() => {
    if (contract?.abi) {
      const constructor = contract.abi.find((item: AbiItem) => item.type === 'constructor');
      if (constructor?.inputs) {
        setConstructorParams(constructor.inputs);
        const defaultValues: Record<string, string> = { ...constructorArgs };
        constructor.inputs.forEach((input: AbiInput) => {
          if (!defaultValues[input.name]) {
            const isOwnerParam = input.name.toLowerCase().includes('owner');
            if (isOwnerParam && walletAddress) {
              defaultValues[input.name] = walletAddress;
            } else {
              defaultValues[input.name] = '';
            }
          }
        });
        setConstructorArgs(defaultValues);
      } else {
        setConstructorParams([]);
      }
    }
  }, [contract?.abi, walletAddress]);

  const isSourceDirty = sourceCode !== contract.soliditySource;

  const handleUpdateSource = async (newSource: string) => {
    if (!projectId || !contract._id) return false;
    setIsSaving(true);
    try {
      const { data } = await api.patch<ApiResponse<Project>>(`/projects/${projectId}/contracts/${contract._id}`, {
        soliditySource: newSource
      });
      if (data.success) {
        onUpdate();
        return true;
      }
      return false;
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Update failed');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleCompile = async () => {
    if (!projectId || !contract._id) return;

    if (isSourceDirty) {
      const saved = await handleUpdateSource(sourceCode);
      if (!saved) return;
    }

    setIsCompiling(true);
    setCompileError('');
    setCompileErrorDetails('');
    try {
      const { data } = await api.post<ApiResponse<any>>(`/projects/${projectId}/contracts/${contract._id}/compile`);
      if (data.success) {
        toast.success('Compilation successful!');
        onUpdate();
      }
    } catch (err: any) {
      const resp = err?.response?.data;
      setCompileError(resp?.message || 'Compilation failed');
      setCompileErrorDetails(resp?.error || '');
      toast.error(resp?.message || 'Compilation failed');
    } finally {
      setIsCompiling(false);
    }
  };

  const handleDeploy = async () => {
    if (!projectId || !contract._id) return;
    setIsDeploying(true);
    setDeployError('');
    setDeployErrorDetails('');

    const missing = constructorParams.some(p => !constructorArgs[p.name]);
    if (missing) {
      setShowArgErrors(true);
      setIsDeploying(false);
      toast.error('Please fill all constructor parameters');
      return;
    }

    const argsArray = constructorParams.map(p => constructorArgs[p.name]);

    try {
      const { data } = await api.post<ApiResponse<any>>(`/projects/${projectId}/contracts/${contract._id}/deploy`, {
        constructorArgs: argsArray,
      });
      if (data.success && data.data) {
        toast.success(`Deployed at ${data.data.contractAddress}`);
        onUpdate();
      }
    } catch (err: any) {
      const resp = err?.response?.data;
      setDeployError(resp?.message || 'Deployment failed');
      setDeployErrorDetails(resp?.error || '');
      toast.error(resp?.message || 'Deployment failed');
    } finally {
      setIsDeploying(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied!`);
  };

  const handleArgChange = (name: string, value: string) => {
    setConstructorArgs(prev => ({ ...prev, [name]: value }));
    setShowArgErrors(false);
    setIsSaved(false);
    setHasChanges(true);
  };

  const handleApplyToSource = async () => {
    let newSource = sourceCode;
    let replacedCount = 0;

    constructorParams.forEach(p => {
      let rawVal = (constructorArgs[p.name] || '').toString().trim();
      if (!rawVal) return;

      let val = rawVal;
      if (p.type.toLowerCase().includes('address') && ethers.isAddress(rawVal)) {
        val = ethers.getAddress(rawVal);
      } else if (p.type.toLowerCase().includes('string')) {
        val = rawVal.replace(/^["']|["']$/g, '');
      }

      const pName = p.name;
      const formattedVal = p.type.toLowerCase().includes('string') ? `"${val}"` : val;

      const patterns = [
        new RegExp(`(\\s*=\\s*(?:[a-zA-Z0-9_]+\\s*\\(\\s*)?|\\(\\s*(?:[^()]*?,\\s*)?)${pName}(\\s*(?:,\\s*[^()]*)?[),;])`, 'gi'),
        new RegExp(`((?:address|string|uint256|uint|bool)\\s+(?:public|private|internal)?\\s*(?:immutable|constant|)?\\s*${pName.replace(/^_/, '')}\\s*=\\s*)(?:"[^"]*"|'[^']*'|address\\(0\\)|0x0[0-9a-fA-F]{39}|[0-9]+|false|true|0);?`, 'gi'),
      ];

      patterns.forEach(regex => {
        const originalSource = newSource;
        newSource = newSource.replace(regex, `$1${formattedVal}$2`);
        if (newSource !== originalSource) replacedCount++;
      });
    });

    setSourceCode(newSource);
    const success = await handleUpdateSource(newSource);
    if (success) {
      toast.success(replacedCount > 0 ? 'Dependencies Injected into Source Code' : 'Source Optimized');
      setIsSaved(true);
      setHasChanges(false);
    }
  };

  const LogViewer = ({ title, log }: { title: string, log: string }) => {
    if (!log) return null;
    return (
      <div className="log-viewer-container">
        <div className="log-viewer-header">
          <button className="btn-copy-log" onClick={() => copyToClipboard(log, 'Full Log')}>
            <HiOutlineDocumentDuplicate /> Copy Log
          </button>
          <span className="log-viewer-title">{title}</span>
        </div>
        <div className="log-viewer-body">
          <pre>{log}</pre>
        </div>
      </div>
    );
  };

  const statusSteps = [
    { key: 'created', label: 'Created', done: true },
    { key: 'compiled', label: 'Compiled', done: contract.status === 'compiled' || contract.status === 'deployed' },
    { key: 'deployed', label: 'Deployed', done: contract.status === 'deployed' },
  ];

  return (
    <div className="smart-contract-component">
      {/* Status Pipeline */}
      <div className="pipeline-bar">
        {statusSteps.map((step, i) => (
          <div key={step.key} className={`pipeline-step ${step.done ? 'done' : ''}`}>
            <div className="pipeline-dot">
              {step.done ? <HiOutlineCheckCircle color="var(--color-success)" /> : <span>{i + 1}</span>}
            </div>
            <span className="pipeline-label">{step.label}</span>
            {i < statusSteps.length - 1 && <div className="pipeline-line" />}
          </div>
        ))}
      </div>

      {/* Info Cards */}
      <div className="detail-grid">
        <div className="detail-info-card">
          <h4>Status</h4>
          <span className={`badge ${
            contract.status === 'deployed' ? 'badge-success' 
            : contract.status === 'compiled' ? 'badge-warning'
            : 'badge-info'
          }`}>
            {contract.status}
          </span>
        </div>
        <div className="detail-info-card">
          <h4>Solidity</h4>
          <span className="detail-value">{contract.solidityVersion || '—'}</span>
        </div>
        <div className="detail-info-card">
          <h4>Network</h4>
          <span className="detail-value">{network}</span>
        </div>
        <div className="detail-info-card">
          <h4>Updated</h4>
          <span className="detail-value">{new Date(contract.updatedAt).toLocaleDateString('vi-VN')}</span>
        </div>
      </div>

      {/* Contract Address */}
      {contract.contractAddress && (
        <div className="detail-section deployed-section">
          <div className="deployed-header">
            <HiOutlineRocketLaunch className="deployed-icon" />
            <div>
              <h3>Contract Deployed</h3>
              <div className="deployed-address mono">
                {contract.contractAddress}
                <button className="copy-btn" onClick={() => copyToClipboard(contract.contractAddress!, 'Address')}>
                  <HiOutlineDocumentDuplicate />
                </button>
              </div>
            </div>
          </div>
          <a
            href={`https://testnet.bscscan.com/address/${contract.contractAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary btn-sm"
          >
            <HiOutlineArrowTopRightOnSquare /> View on BscScan
          </a>
        </div>
      )}

      {/* Constructor Form */}
      {isOwner && contract.status === 'compiled' && constructorParams.length > 0 && (
        <div className="constructor-form-container">
          <div className="constructor-header">
            <HiOutlineExclamationTriangle className="icon-warning" />
            <div>
              <h4>Constructor Arguments Required</h4>
              <p>Please provide the dependencies below before deploying.</p>
            </div>
            <button className="btn-sm btn-recompile-source" onClick={handleApplyToSource} disabled={isSaving || isSaved || !hasChanges}>
              {isSaved ? <HiOutlineCheck /> : <HiOutlineArrowDownTray />} {isSaving ? 'Saving...' : isSaved ? 'Saved' : 'Save'}
            </button>
          </div>
          <div className="constructor-grid">
            {constructorParams.map((p) => (
              <div key={p.name} className="arg-field">
                <label>{p.name} <span>({p.type})</span></label>
                <input
                  type="text"
                  className={`form-input ${showArgErrors && !constructorArgs[p.name] ? 'blink-error' : ''}`}
                  placeholder={`Enter ${p.type}...`}
                  value={constructorArgs[p.name] || ''}
                  onChange={(e) => handleArgChange(p.name, e.target.value)}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gas Estimate */}
      {isOwner && contract.status === 'compiled' && (
        <DeployGasEstimate projectId={projectId} contractId={contract._id} />
      )}

      {/* Actions */}
      <div className="detail-actions">
        {isOwner && contract.status === 'created' && (
          <button className="btn btn-primary btn-lg" onClick={handleCompile} disabled={isCompiling}>
            {isCompiling ? <><span className="spinner" /> Compiling...</> : <><HiOutlineCpuChip /> Compile Contract</>}
          </button>
        )}

        {isOwner && contract.status === 'compiled' && (
          <>
            <button className="btn btn-secondary" onClick={handleCompile} disabled={isCompiling || !isSourceDirty}>
              {isCompiling ? <><span className="spinner" /> Re-compiling...</> : <><HiOutlineCpuChip /> Re-compile</>}
            </button>
            <button className="btn btn-primary btn-lg" onClick={handleDeploy} disabled={isDeploying}>
              {isDeploying ? <><span className="spinner" /> Deploying...</> : <><HiOutlineRocketLaunch /> Deploy</>}
            </button>
          </>
        )}

        {contract.status === 'deployed' && (
          <Link to={`/projects/${projectId}/contracts/${contract._id}/interact`} className="btn btn-primary btn-lg">
            <HiOutlineCodeBracket /> Interact
          </Link>
        )}

        {isOwner && (contract.status === 'compiled' || contract.status === 'deployed') && (
          <Link to={`/projects/${projectId}/contracts/${contract._id}/test`} className="btn btn-secondary">
            🧪 Run Tests
          </Link>
        )}
      </div>

      {/* Error Displays */}
      {compileError && (
        <div className="detail-error">
          <HiOutlineExclamationTriangle />
          <div style={{ flex: 1 }}>
            <strong>Compilation Error</strong>
            <pre className="error-summary">{compileError}</pre>
            <LogViewer title="Compilation Log" log={compileErrorDetails} />
          </div>
        </div>
      )}
      {deployError && (
        <div className="detail-error">
          <HiOutlineExclamationTriangle />
          <div style={{ flex: 1 }}>
            <strong>Deploy Error</strong>
            <pre className="error-summary">{deployError}</pre>
            <LogViewer title="Deployment Log" log={deployErrorDetails} />
          </div>
        </div>
      )}

      {/* ABI Viewer */}
      {contract.abi && contract.abi.length > 0 && (
        <div className="detail-section">
          <div className="collapsible-header" onClick={() => setShowAbi(!showAbi)}>
            {showAbi ? <HiOutlineChevronDown /> : <HiOutlineChevronRight />}
            <span>ABI ({contract.abi.length} items)</span>
          </div>
          {showAbi && (
            <div className="abi-list">
              {contract.abi.map((item, i) => (
                <div key={i} className="abi-item">
                  <span className={`abi-type badge ${item.type === 'function' ? 'badge-info' : 'badge-accent'}`}>{item.type}</span>
                  <span className="abi-name mono">{item.name || item.type}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Source Code */}
      <div className="detail-section">
        <div className="collapsible-header" onClick={() => setShowSource(!showSource)}>
          {showSource ? <HiOutlineChevronDown /> : <HiOutlineChevronRight />}
          <span>Source Code {isSourceDirty && <span className="dirty-tag">(Edited)</span>}</span>
        </div>
        {showSource && (
          <div className="source-editor-container">
            <textarea
              className="source-editor-textarea"
              value={sourceCode}
              onChange={(e) => setSourceCode(e.target.value)}
              readOnly={!isOwner || contract.status === 'deployed' || isSaving}
              spellCheck={false}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function HiOutlineCheckCircle({ color }: { color: string }) {
  return (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke={color} style={{ width: 20, height: 20 }}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
