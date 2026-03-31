import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, Link } from 'react-router-dom';
import DeployGasEstimate from '../components/Contract/DeployGasEstimate';
import {
  HiOutlineCodeBracket,
  HiOutlineRocketLaunch,
  HiOutlineCheckCircle,
  HiOutlineDocumentDuplicate,
  HiOutlineArrowTopRightOnSquare,
  HiOutlineChevronDown,
  HiOutlineChevronRight,
  HiOutlineExclamationTriangle,
  HiOutlineCpuChip,
  HiOutlinePencilSquare,
  HiOutlineCheck,
  HiOutlineXMark,
} from 'react-icons/hi2';
import toast from 'react-hot-toast';
import PageWrapper from '../components/Layout/PageWrapper';
import api from '../services/api';
import type { ApiResponse, Project, AbiItem, AbiInput } from '../types';
import { ethers } from 'ethers';
import './ProjectDetailPage.css';

export default function ProjectDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
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

  // Editing states
  const [isEditingMetadata, setIsEditingMetadata] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [sourceCode, setSourceCode] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const fetchProject = useCallback(async () => {
    if (!id) return;
    try {
      setIsLoading(true);
      const { data } = await api.get<ApiResponse<Project>>(`/projects/${id}`);
      if (data.success && data.data) {
        setProject(data.data);
        setEditName(data.data.name);
        setEditDesc(data.data.description || '');
        setSourceCode(data.data.soliditySource);
      }
    } catch {
      toast.error('Failed to load project');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchProject(); }, [fetchProject]);

  // Extract constructor params when project/ABI changes
  useEffect(() => {
    if (project?.abi) {
      const constructor = project.abi.find((item: AbiItem) => item.type === 'constructor');
      if (constructor?.inputs) {
        setConstructorParams(constructor.inputs);
        // Pre-fill initialOwner if not already set
        const defaultValues: Record<string, string> = { ...constructorArgs };
        constructor.inputs.forEach((input: AbiInput) => {
          if (!defaultValues[input.name]) {
            const isOwner = input.name.toLowerCase().includes('owner');
            if (isOwner && typeof project.walletId === 'object' && project.walletId.address) {
              defaultValues[input.name] = project.walletId.address;
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
  }, [project?.abi, project?.walletId]);

  const isSourceDirty = project ? sourceCode !== project.soliditySource : false;

  // ─── Save Updates ───
  const handleUpdate = async (updates: { name?: string; description?: string; soliditySource?: string }) => {
    if (!id) return false;
    setIsSaving(true);
    try {
      const { data } = await api.patch<ApiResponse<Project>>(`/projects/${id}`, updates);
      if (data.success && data.data) {
        setProject(data.data);
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

  const handleSaveMetadata = async () => {
    const success = await handleUpdate({ name: editName, description: editDesc });
    if (success) {
      setIsEditingMetadata(false);
      toast.success('Project updated');
    }
  };

  // ─── Compile ───
  const handleCompile = async () => {
    if (!id) return;

    // Auto-save if source changed
    if (isSourceDirty) {
      const saved = await handleUpdate({ soliditySource: sourceCode });
      if (!saved) return; // Stop if save failed
    }

    setIsCompiling(true);
    setCompileError('');
    setCompileErrorDetails('');
    try {
      const { data } = await api.post<ApiResponse<Project>>(`/projects/${id}/compile`);
      if (data.success && data.data) {
        toast.success('Compilation successful!');
        fetchProject();
      }
    } catch (err: any) {
      const resp = err?.response?.data;
      const msg = resp?.message || 'Compilation failed';
      const details = resp?.error || '';
      setCompileError(msg);
      setCompileErrorDetails(details);
      toast.error(msg);
    } finally {
      setIsCompiling(false);
    }
  };

  // ─── Deploy ───
  const handleDeploy = async () => {
    if (!id) return;
    setIsDeploying(true);
    setDeployError('');
    setDeployErrorDetails('');

    // Validate constructor args
    const missing = constructorParams.some(p => !constructorArgs[p.name]);
    if (missing) {
      setShowArgErrors(true);
      setIsDeploying(false);
      toast.error('Please fill all constructor parameters');
      return;
    }

    const argsArray = constructorParams.map(p => constructorArgs[p.name]);

    try {
      const { data } = await api.post<ApiResponse<any>>(`/projects/${id}/deploy`, {
        constructorArgs: argsArray,
      });
      if (data.success && data.data) {
        toast.success(`Deployed at ${data.data.contractAddress}`);
        fetchProject();
      }
    } catch (err: any) {
      const resp = err?.response?.data;
      const msg = resp?.message || 'Deployment failed';
      const details = resp?.error || '';
      setDeployError(msg);
      setDeployErrorDetails(details);
      toast.error(msg);
    } finally {
      setIsDeploying(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied!`);
  };

  const LogViewer = ({ title, log }: { title: string, log: string }) => {
    if (!log) return null;
    return (
      <div className="log-viewer-container">
        <div className="log-viewer-header">
          <button 
            className="btn-copy-log" 
            onClick={() => copyToClipboard(log, 'Full Log')}
            title="Copy full log"
          >
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

  const handleArgChange = (name: string, value: string) => {
    setConstructorArgs(prev => ({ ...prev, [name]: value }));
    setShowArgErrors(false);
  };

  const handleApplyToSource = async () => {
    let newSource = sourceCode;
    let replacedCount = 0;

    constructorParams.forEach(p => {
      let rawVal = (constructorArgs[p.name] || '').toString().trim();
      if (!rawVal) return;

      // 1. Sanitize & Checksum (Frontend Layer)
      let val = rawVal;
      if (p.type.toLowerCase().includes('address') && ethers.isAddress(rawVal)) {
        val = ethers.getAddress(rawVal); // Force Checksum (EIP-55)
      } else if (p.type.toLowerCase().includes('string')) {
        val = rawVal.replace(/^["']|["']$/g, ''); // Strip user-added quotes
      }

      const pName = p.name;
      const formattedVal = p.type.toLowerCase().includes('string') ? `"${val}"` : val;

      // Universal Search & Replace Tactics (V3 - Resilience Focused)
      const patterns = [
        // A. Assignment OR Usage in parenthesis (Handle Parent(arg) or Type(arg))
        new RegExp(`(\\s*=\\s*(?:[a-zA-Z0-9_]+\\s*\\(\\s*)?|\\(\\s*(?:[^()]*?,\\s*)?)${pName}(\\s*(?:,\\s*[^()]*)?[),;])`, 'gi'),

        // B. Standalone definition
        new RegExp(`((?:address|string|uint256|uint|bool)\\s+(?:public|private|internal)?\\s*(?:immutable|constant|)?\\s*${pName.replace(/^_/, '')}\\s*=\\s*)(?:"[^"]*"|'[^']*'|address\\(0\\)|0x0[0-9a-fA-F]{39}|[0-9]+|false|true|0);?`, 'gi'),
      ];

      patterns.forEach(regex => {
        const originalSource = newSource;
        newSource = newSource.replace(regex, `$1${formattedVal}$2`);
        if (newSource !== originalSource) {
          replacedCount++;
        }
      });
    });

    // Layer 2 Defense: Proceed anyway even if frontend count is 0. 
    // The Backend 'repairAddressChecksums' will handle any missing checksums.
    setSourceCode(newSource);
    const success = await handleUpdate({ soliditySource: newSource });
    if (success) {
      toast.success(replacedCount > 0 ? 'Dependencies Injected & Re-compiling...' : 'Source Optimized & Re-compiling...');
      handleCompile();
    }
  };

  if (isLoading) {
    return (
      <PageWrapper title="Project">
        <div className="detail-loading">
          <div className="skeleton" style={{ height: 32, width: '50%', marginBottom: 16 }} />
          <div className="skeleton" style={{ height: 120, marginBottom: 16 }} />
          <div className="skeleton" style={{ height: 48 }} />
        </div>
      </PageWrapper>
    );
  }

  if (!project) {
    return (
      <PageWrapper title="Not Found">
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-16)' }}>
          <h3>Project not found</h3>
          <Link to="/projects" className="btn btn-primary" style={{ marginTop: 'var(--space-4)' }}>
            Back to Projects
          </Link>
        </div>
      </PageWrapper>
    );
  }

  const statusSteps = [
    { key: 'created', label: 'Created', done: true },
    { key: 'compiled', label: 'Compiled', done: project.status === 'compiled' || project.status === 'deployed' },
    { key: 'deployed', label: 'Deployed', done: project.status === 'deployed' },
  ];

  return (
    <PageWrapper 
      title={isEditingMetadata ? (
        <input 
          className="edit-title-input"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          placeholder="Project Title"
        />
      ) : project!.name} 
      subtitle={isEditingMetadata ? (
        <div className="edit-metadata-actions">
          <textarea 
            className="edit-desc-input"
            value={editDesc}
            onChange={(e) => setEditDesc(e.target.value)}
            placeholder="Project Description"
          />
          <div className="edit-buttons">
            <button className="btn btn-primary btn-sm" onClick={handleSaveMetadata} disabled={isSaving}>
              <HiOutlineCheck /> Save
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => {
              setIsEditingMetadata(false);
              setEditName(project!.name);
              setEditDesc(project!.description || '');
            }}>
              <HiOutlineXMark /> Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="subtitle-container">
          <span>{project!.description || t('pages.projects.detail.subtitle_fallback')}</span>
          <button className="edit-icon-btn" onClick={() => setIsEditingMetadata(true)} title="Edit Title & Description">
            <HiOutlinePencilSquare />
          </button>
        </div>
      )}
    >
      <div className="detail-page">
        {/* Status Pipeline */}
        <div className="pipeline-bar">
          {statusSteps.map((step, i) => (
            <div key={step.key} className={`pipeline-step ${step.done ? 'done' : ''}`}>
              <div className="pipeline-dot">
                {step.done ? <HiOutlineCheckCircle /> : <span>{i + 1}</span>}
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
              project!.status === 'deployed' ? 'badge-success' 
              : project!.status === 'compiled' ? 'badge-warning'
              : 'badge-info'
            }`}>
              {project!.status}
            </span>
          </div>
          <div className="detail-info-card">
            <h4>Solidity</h4>
            <span className="detail-value">{project!.solidityVersion || '—'}</span>
          </div>
          <div className="detail-info-card">
            <h4>Network</h4>
            <span className="detail-value">{project!.network}</span>
          </div>
          <div className="detail-info-card">
            <h4>Created</h4>
            <span className="detail-value">{new Date(project!.createdAt).toLocaleDateString('vi-VN')}</span>
          </div>
        </div>

        {/* Contract Address (if deployed) */}
        {project!.contractAddress && (
          <div className="detail-section deployed-section">
            <div className="deployed-header">
              <HiOutlineRocketLaunch className="deployed-icon" />
              <div>
                <h3>Contract Deployed</h3>
                <div className="deployed-address mono">
                  {project!.contractAddress}
                  <button
                    className="copy-btn"
                    onClick={() => copyToClipboard(project!.contractAddress!, 'Address')}
                    title="Copy address"
                  >
                    <HiOutlineDocumentDuplicate />
                  </button>
                </div>
              </div>
            </div>
            <a
              href={`https://testnet.bscscan.com/address/${project!.contractAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary btn-sm"
            >
              <HiOutlineArrowTopRightOnSquare /> View on BscScan
            </a>
          </div>
        )}

        {/* Constructor Form */}
        {project!.status === 'compiled' && constructorParams.length > 0 && (
          <div className="constructor-form-container">
            <div className="constructor-header">
              <HiOutlineExclamationTriangle className="icon-warning" />
              <div>
                <h4>Constructor Arguments Required</h4>
                <p>Please provide the dependencies below before deploying.</p>
              </div>
              <button 
                className="btn-sm btn-recompile-source" 
                onClick={handleApplyToSource}
                title="Embed current values into Solidity source and re-compile"
              >
                <HiOutlineCpuChip /> Re-compile
              </button>
            </div>
            <div className="constructor-grid">
              {constructorParams.map((p) => {
                const isUri = p.name.toLowerCase().includes('uri');
                const isAddress = p.type === 'address';
                return (
                  <div key={p.name} className="arg-field">
                    <label>
                      {p.name} <span>({p.type})</span>
                    </label>
                    <input
                      type="text"
                      className={`form-input ${showArgErrors && !constructorArgs[p.name] ? 'blink-error' : ''}`}
                      placeholder={isUri ? 'e.g., ipfs://.../ or https://...' : isAddress ? '0x...' : `Enter ${p.type}...`}
                      value={constructorArgs[p.name] || ''}
                      onChange={(e) => handleArgChange(p.name, e.target.value)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Gas Estimate before Deploy */}
        {project!.status === 'compiled' && id && (
          <DeployGasEstimate projectId={id} />
        )}

        {/* Action Buttons */}
        <div className="detail-actions">
          {project!.status === 'created' && (
            <button
              className="btn btn-primary btn-lg"
              onClick={handleCompile}
              disabled={isCompiling}
            >
              {isCompiling ? (
                <><span className="spinner" /> Compiling... (10-30s)</>
              ) : (
                <><HiOutlineCpuChip /> Compile Contract</>
              )}
            </button>
          )}

          {project!.status === 'compiled' && (
            <>
              <button
                className="btn btn-secondary"
                onClick={handleCompile}
                disabled={isCompiling || !isSourceDirty}
                title={isSourceDirty ? 'Apply changes and re-compile' : 'No changes to compile'}
              >
                {isCompiling ? <><span className="spinner" /> Re-compiling...</> : <><HiOutlineCpuChip /> Re-compile</>}
              </button>
              <button
                className="btn btn-primary btn-lg"
                onClick={handleDeploy}
                disabled={isDeploying}
              >
                {isDeploying ? (
                  <><span className="spinner" /> Deploying to BSC Testnet...</>
                ) : (
                  <><HiOutlineRocketLaunch /> Deploy to BSC Testnet</>
                )}
              </button>
            </>
          )}

          {project!.status === 'deployed' && (
            <Link to={`/projects/${project!._id}/interact`} className="btn btn-primary btn-lg">
              <HiOutlineCodeBracket /> Interact with Contract
            </Link>
          )}

          {/* Test button — available after compilation */}
          {(project!.status === 'compiled' || project!.status === 'deployed') && (
            <Link to={`/projects/${project!._id}/test`} className="btn btn-secondary">
              🧪 Run Tests
            </Link>
          )}
        </div>

        {/* Error Messages */}
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
        {project!.abi && project!.abi.length > 0 && (
          <div className="detail-section">
          <div
            className="collapsible-header"
            onClick={() => setShowAbi(!showAbi)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowAbi(!showAbi); } }}
          >
            {showAbi ? <HiOutlineChevronDown /> : <HiOutlineChevronRight />}
            <span>ABI ({project!.abi.length} items)</span>
            <button
              className="copy-btn"
              onClick={(e) => { e.stopPropagation(); copyToClipboard(JSON.stringify(project!.abi, null, 2), 'ABI'); }}
              title="Copy ABI"
            >
              <HiOutlineDocumentDuplicate />
            </button>
          </div>
            {showAbi && (
              <div className="abi-list">
                {project!.abi.map((item: AbiItem, i: number) => (
                  <div key={i} className="abi-item">
                    <span className={`abi-type badge ${
                      item.type === 'function' ? (item.stateMutability === 'view' || item.stateMutability === 'pure' ? 'badge-info' : 'badge-warning')
                      : item.type === 'event' ? 'badge-accent'
                      : 'badge-error'
                    }`}>{item.type}</span>
                    <span className="abi-name mono">{item.name || item.type}</span>
                    {item.inputs && item.inputs.length > 0 && (
                      <span className="abi-params">
                        ({item.inputs.map(inp => `${inp.type} ${inp.name}`).join(', ')})
                      </span>
                    )}
                    {item.stateMutability && (
                      <span className="abi-mutability">{item.stateMutability}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Bytecode Preview */}
        {project!.bytecode && (
          <div className="detail-section">
            <div className="bytecode-preview">
              <span className="input-label">Bytecode</span>
              <span className="bytecode-size">({Math.ceil(project!.bytecode.length / 2)} bytes)</span>
              <button
                className="copy-btn"
                onClick={() => copyToClipboard(project!.bytecode!, 'Bytecode')}
                title="Copy Bytecode"
              >
                <HiOutlineDocumentDuplicate />
              </button>
            </div>
            <div className="mono bytecode-text">{project!.bytecode.substring(0, 100)}...</div>
          </div>
        )}

        {/* Source Code Collapsible */}
        {project!.soliditySource && (
          <div className="detail-section">
          <div
            className="collapsible-header"
            onClick={() => setShowSource(!showSource)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowSource(!showSource); } }}
          >
            {showSource ? <HiOutlineChevronDown /> : <HiOutlineChevronRight />}
            <span>Source Code {isSourceDirty && <span className="dirty-tag">(Edited - Click Compile to save)</span>}</span>
          </div>
            {showSource && (
              <div className="source-editor-container">
                <textarea
                  className="source-editor-textarea"
                  value={sourceCode}
                  onChange={(e) => setSourceCode(e.target.value)}
                  readOnly={project!.status === 'deployed'}
                  spellCheck={false}
                />
                {project!.status === 'deployed' && (
                  <div className="source-lock-notice">
                    <HiOutlineExclamationTriangle /> Source code is locked after deployment
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </PageWrapper>
  );
}
