import { useState, useEffect, useCallback } from 'react';
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
} from 'react-icons/hi2';
import toast from 'react-hot-toast';
import PageWrapper from '../components/Layout/PageWrapper';
import api from '../services/api';
import type { ApiResponse, Project, AbiItem } from '../types';
import './ProjectDetailPage.css';

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCompiling, setIsCompiling] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [compileError, setCompileError] = useState('');
  const [deployError, setDeployError] = useState('');
  const [showSource, setShowSource] = useState(false);
  const [showAbi, setShowAbi] = useState(false);

  const fetchProject = useCallback(async () => {
    if (!id) return;
    try {
      setIsLoading(true);
      const { data } = await api.get<ApiResponse<Project>>(`/projects/${id}`);
      if (data.success && data.data) {
        setProject(data.data);
      }
    } catch {
      toast.error('Failed to load project');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchProject(); }, [fetchProject]);

  // ─── Compile ───
  const handleCompile = async () => {
    if (!id) return;
    setIsCompiling(true);
    setCompileError('');
    try {
      const { data } = await api.post<ApiResponse<Project>>(`/projects/${id}/compile`);
      if (data.success && data.data) {
        toast.success('Compilation successful!');
        // Refresh project to get ABI/bytecode
        fetchProject();
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Compilation failed';
      setCompileError(msg);
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
    try {
      const { data } = await api.post<ApiResponse<any>>(`/projects/${id}/deploy`, {
        constructorArgs: [],
      });
      if (data.success && data.data) {
        toast.success(`Deployed at ${data.data.contractAddress}`);
        fetchProject();
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Deployment failed';
      setDeployError(msg);
      toast.error(msg);
    } finally {
      setIsDeploying(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied!`);
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
    <PageWrapper title={project.name} subtitle={project.description || 'Smart contract project'}>
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
              project.status === 'deployed' ? 'badge-success' 
              : project.status === 'compiled' ? 'badge-warning'
              : 'badge-info'
            }`}>
              {project.status}
            </span>
          </div>
          <div className="detail-info-card">
            <h4>Solidity</h4>
            <span className="detail-value">{project.solidityVersion || '—'}</span>
          </div>
          <div className="detail-info-card">
            <h4>Network</h4>
            <span className="detail-value">{project.network}</span>
          </div>
          <div className="detail-info-card">
            <h4>Created</h4>
            <span className="detail-value">{new Date(project.createdAt).toLocaleDateString('vi-VN')}</span>
          </div>
        </div>

        {/* Contract Address (if deployed) */}
        {project.contractAddress && (
          <div className="detail-section deployed-section">
            <div className="deployed-header">
              <HiOutlineRocketLaunch className="deployed-icon" />
              <div>
                <h3>Contract Deployed</h3>
                <div className="deployed-address mono">
                  {project.contractAddress}
                  <button
                    className="copy-btn"
                    onClick={() => copyToClipboard(project.contractAddress!, 'Address')}
                    title="Copy address"
                  >
                    <HiOutlineDocumentDuplicate />
                  </button>
                </div>
              </div>
            </div>
            <a
              href={`https://testnet.bscscan.com/address/${project.contractAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary btn-sm"
            >
              <HiOutlineArrowTopRightOnSquare /> View on BscScan
            </a>
          </div>
        )}

        {/* Gas Estimate before Deploy */}
        {project.status === 'compiled' && id && (
          <DeployGasEstimate projectId={id} />
        )}

        {/* Action Buttons */}
        <div className="detail-actions">
          {project.status === 'created' && (
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

          {project.status === 'compiled' && (
            <>
              <button
                className="btn btn-secondary"
                onClick={handleCompile}
                disabled={isCompiling}
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

          {project.status === 'deployed' && (
            <Link to={`/projects/${project._id}/interact`} className="btn btn-primary btn-lg">
              <HiOutlineCodeBracket /> Interact with Contract
            </Link>
          )}

          {/* Test button — available after compilation */}
          {(project.status === 'compiled' || project.status === 'deployed') && (
            <Link to={`/projects/${project._id}/test`} className="btn btn-secondary">
              🧪 Run Tests
            </Link>
          )}
        </div>

        {/* Error Messages */}
        {compileError && (
          <div className="detail-error">
            <HiOutlineExclamationTriangle />
            <div>
              <strong>Compilation Error</strong>
              <pre>{compileError}</pre>
            </div>
          </div>
        )}
        {deployError && (
          <div className="detail-error">
            <HiOutlineExclamationTriangle />
            <div>
              <strong>Deploy Error</strong>
              <pre>{deployError}</pre>
            </div>
          </div>
        )}

        {/* ABI Viewer */}
        {project.abi && project.abi.length > 0 && (
          <div className="detail-section">
            <button className="collapsible-header" onClick={() => setShowAbi(!showAbi)}>
              {showAbi ? <HiOutlineChevronDown /> : <HiOutlineChevronRight />}
              <span>ABI ({project.abi.length} items)</span>
              <button
                className="copy-btn"
                onClick={(e) => { e.stopPropagation(); copyToClipboard(JSON.stringify(project.abi, null, 2), 'ABI'); }}
                title="Copy ABI"
              >
                <HiOutlineDocumentDuplicate />
              </button>
            </button>
            {showAbi && (
              <div className="abi-list">
                {project.abi.map((item: AbiItem, i: number) => (
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
        {project.bytecode && (
          <div className="detail-section">
            <div className="bytecode-preview">
              <span className="input-label">Bytecode</span>
              <span className="bytecode-size">({Math.ceil(project.bytecode.length / 2)} bytes)</span>
              <button
                className="copy-btn"
                onClick={() => copyToClipboard(project.bytecode!, 'Bytecode')}
                title="Copy Bytecode"
              >
                <HiOutlineDocumentDuplicate />
              </button>
            </div>
            <div className="mono bytecode-text">{project.bytecode.substring(0, 100)}...</div>
          </div>
        )}

        {/* Source Code Collapsible */}
        {project.soliditySource && (
          <div className="detail-section">
            <button className="collapsible-header" onClick={() => setShowSource(!showSource)}>
              {showSource ? <HiOutlineChevronDown /> : <HiOutlineChevronRight />}
              <span>Source Code</span>
            </button>
            {showSource && (
              <pre className="source-code-block">{project.soliditySource}</pre>
            )}
          </div>
        )}
      </div>
    </PageWrapper>
  );
}
