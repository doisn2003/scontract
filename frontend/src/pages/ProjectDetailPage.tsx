import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, Navigate, Link } from 'react-router-dom';
import {
  HiOutlineCheck,
  HiOutlineXMark,
  HiOutlinePencilSquare,
  HiOutlineExclamationTriangle,
} from 'react-icons/hi2';
import toast from 'react-hot-toast';
import PageWrapper from '../components/Layout/PageWrapper';
import api from '../services/api';
import type { ApiResponse, Project } from '../types';
import { useAuth } from '../context/AuthContext';
import ContractTabBar from '../components/Contract/ContractTabBar';
import SmartContract from '../components/Contract/SmartContract';
import './ProjectDetailPage.css';

export default function ProjectDetailPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeContractId, setActiveContractId] = useState<string | null>(null);

  // Editing metadata states
  const [isEditingMetadata, setIsEditingMetadata] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
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
        
        // Auto-select first contract if none active
        if (data.data.contracts.length > 0 && !activeContractId) {
          setActiveContractId(data.data.contracts[0]._id);
        }
      }
    } catch {
      toast.error('Failed to load project');
    } finally {
      setIsLoading(false);
    }
  }, [id, activeContractId]);

  useEffect(() => { fetchProject(); }, [fetchProject]);

  const isOwner = user?._id === project?.userId;

  // ─── Metadata Handlers ───
  const handleSaveMetadata = async () => {
    if (!id) return;
    setIsSaving(true);
    try {
      const { data } = await api.patch<ApiResponse<Project>>(`/projects/${id}`, {
        name: editName,
        description: editDesc
      });
      if (data.success && data.data) {
        setProject(data.data);
        setIsEditingMetadata(false);
        toast.success('Project updated');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Update failed');
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Contract Handlers ───
  const handleAddContract = async () => {
    if (!id) return;
    const name = window.prompt('Enter contract name:', 'NewContract');
    if (!name) return;

    try {
      const { data } = await api.post<ApiResponse<Project>>(`/projects/${id}/contracts`, { name });
      if (data.success && data.data) {
        setProject(data.data);
        // Select the new contract
        const newContract = data.data.contracts[data.data.contracts.length - 1];
        setActiveContractId(newContract._id);
        toast.success('Contract added');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to add contract');
    }
  };

  const handleRemoveContract = async (contractId: string) => {
    if (!id) return;
    try {
      const { data } = await api.delete<ApiResponse<Project>>(`/projects/${id}/contracts/${contractId}`);
      if (data.success && data.data) {
        setProject(data.data);
        if (activeContractId === contractId) {
          setActiveContractId(data.data.contracts[0]?._id || null);
        }
        toast.success('Contract removed');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to remove contract');
    }
  };

  const handleRenameContract = async (contractId: string, newName: string) => {
    if (!id) return;
    try {
      const { data } = await api.patch<ApiResponse<Project>>(`/projects/${id}/contracts/${contractId}`, {
        name: newName
      });
      if (data.success && data.data) {
        setProject(data.data);
        toast.success('Contract renamed');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to rename contract');
    }
  };

  const handleReorderContracts = async (contractIds: string[]) => {
    if (!id) return;
    try {
      const { data } = await api.put<ApiResponse<Project>>(`/projects/${id}/contracts/reorder`, {
        contractIds
      });
      if (data.success && data.data) {
        setProject(data.data);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to sync reorder');
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
    return <Navigate to="/projects" replace />;
  }

  const contracts = project.contracts || [];
  const activeContract = contracts.find(c => c?._id === activeContractId) || contracts[0];

  if (contracts.length === 0) {
    return (
      <PageWrapper title={project.name}>
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-16)' }}>
          <HiOutlineExclamationTriangle style={{ fontSize: '3rem', color: 'var(--color-warning)', marginBottom: 16 }} />
          <h3>Legacy Project Data</h3>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: 16 }}>
            This project is using an old data format and needs to be migrated to support multi-contract features.
          </p>
          <Link to="/projects" className="btn btn-primary">Back to Projects</Link>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper 
      title={isEditingMetadata ? (
        <input 
          className="edit-title-input"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          placeholder="Project Title"
        />
      ) : project.name} 
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
              setEditName(project.name);
              setEditDesc(project.description || '');
            }}>
              <HiOutlineXMark /> Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="subtitle-container">
          <span>{project.description || t('pages.projects.detail.subtitle_fallback')}</span>
          {isOwner && (
            <button className="edit-icon-btn" onClick={() => setIsEditingMetadata(true)} title="Edit Title & Description">
              <HiOutlinePencilSquare />
            </button>
          )}
          {!isOwner && <span className="badge badge-info status-readonly">Read Only</span>}
        </div>
      )}
    >
      <div className="project-ide-container">
        {/* Tab Bar */}
        <ContractTabBar 
          contracts={(project.contracts || []).map(c => ({ _id: c._id, name: c.name }))}
          activeId={activeContractId || project.contracts?.[0]?._id || ''}
          onTabChange={setActiveContractId}
          onAddContract={handleAddContract}
          onRemoveContract={handleRemoveContract}
          onRenameContract={handleRenameContract}
          onReorderContracts={handleReorderContracts}
          isOwner={isOwner}
        />

        {/* Active Contract Logic */}
        {activeContract ? (
          <SmartContract 
            projectId={project._id}
            contract={activeContract}
            isOwner={isOwner}
            walletAddress={typeof project.walletId === 'object' ? project.walletId.address : undefined}
            onUpdate={fetchProject}
            network={project.network}
          />
        ) : (
          <div className="no-contracts">
            <p>No contracts found in this project.</p>
            {isOwner && <button className="btn btn-primary" onClick={handleAddContract}>Add Contract</button>}
          </div>
        )}
      </div>
    </PageWrapper>
  );
}

