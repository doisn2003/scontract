import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  HiOutlineCodeBracket,
  HiOutlineDocumentArrowUp,
  HiOutlineWallet,
  HiOutlinePlusCircle,
  HiOutlineXMark,
} from 'react-icons/hi2';
import toast from 'react-hot-toast';
import PageWrapper from '../components/Layout/PageWrapper';
import api from '../services/api';
import type { ApiResponse, Wallet, Project } from '../types';
import './CreateProjectPage.css';

export default function CreateProjectPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [walletsLoading, setWalletsLoading] = useState(true);

  // Form
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [walletId, setWalletId] = useState('');
  const [contracts, setContracts] = useState<{ id: string; name: string; soliditySource: string }[]>([]);
  const [activeContractId, setActiveContractId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch wallets
  const fetchWallets = useCallback(async () => {
    try {
      const { data } = await api.get<ApiResponse<Wallet[]>>('/wallets');
      if (data.success && data.data) {
        setWallets(data.data);
        if (data.data.length > 0) setWalletId(data.data[0]._id);
      }
    } catch {
      toast.error('Failed to load wallets');
    } finally {
      setWalletsLoading(false);
    }
  }, []);

  useEffect(() => { fetchWallets(); }, [fetchWallets]);

  // File drop/upload handler
  const handleFileSelect = (files: FileList) => {
    Array.from(files).forEach(file => {
      if (!file.name.endsWith('.sol')) {
        toast.error(`${file.name} is not a Solidity file`);
        return;
      }
      if (file.size > 500 * 1024) {
        toast.error(`${file.name} is too large (max 500KB)`);
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        const newContract = {
          id: Math.random().toString(36).substring(2, 9),
          name: file.name.replace('.sol', ''),
          soliditySource: content
        };
        setContracts(prev => [...prev, newContract]);
        setActiveContractId(newContract.id);
        
        // Auto-fill project name if empty
        if (!name) {
          setName(file.name.replace('.sol', ' Project'));
        }
        toast.success(`Loaded ${file.name}`);
      };
      reader.readAsText(file);
    });
  };

  const handleRemoveContract = (id: string) => {
    setContracts(prev => {
      const filtered = prev.filter(c => c.id !== id);
      if (activeContractId === id) {
        setActiveContractId(filtered[0]?.id || null);
      }
      return filtered;
    });
  };

  const handleUpdateActiveSource = (source: string) => {
    setContracts(prev => prev.map(c => 
      c.id === activeContractId ? { ...c, soliditySource: source } : c
    ));
  };

  const handleUpdateActiveName = (newName: string) => {
    setContracts(prev => prev.map(c => 
      c.id === activeContractId ? { ...c, name: newName } : c
    ));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files) handleFileSelect(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  // Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!walletId) {
      toast.error('Please select a wallet');
      return;
    }
    if (contracts.length === 0) {
      toast.error('Please add at least one Solidity contract');
      return;
    }
    
    // Simple validation
    for (const c of contracts) {
      if (!c.soliditySource.includes('pragma solidity')) {
        toast.error(`Invalid Solidity in ${c.name}: missing pragma statement`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const { data } = await api.post<ApiResponse<Project>>('/projects', {
        walletId,
        name: name || 'Untitled Project',
        description,
        contracts: contracts.map(c => ({
          name: c.name,
          soliditySource: c.soliditySource
        }))
      });

      if (data.success && data.data) {
        toast.success('Project created!');
        navigate(`/projects/${data.data._id}`);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to create project';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageWrapper title={t('pages.projects.create.title')} subtitle={t('pages.projects.create.subtitle')}>
      <form className="create-project-form" onSubmit={handleSubmit}>
        {/* Wallet Selector */}
        <div className="form-section">
          <label className="input-label">
            <HiOutlineWallet style={{ verticalAlign: 'middle', marginRight: 6 }} />
            Deployer Wallet
          </label>
          {walletsLoading ? (
            <div className="skeleton" style={{ height: 44 }} />
          ) : wallets.length === 0 ? (
            <div className="form-warning">
              ⚠️ No wallets found. <a href="/wallets">Create one first</a>
            </div>
          ) : (
            <select
              className="input"
              value={walletId}
              onChange={(e) => setWalletId(e.target.value)}
            >
              {wallets.map(w => (
                <option key={w._id} value={w._id}>
                  {w.label} — {w.address.slice(0, 10)}...{w.address.slice(-6)}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Project Info */}
        <div className="form-row">
          <div className="form-section" style={{ flex: 1 }}>
            <label className="input-label">Project Name</label>
            <input
              className="input"
              type="text"
              placeholder="e.g., MyToken"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
            />
          </div>
          <div className="form-section" style={{ flex: 2 }}>
            <label className="input-label">Description (optional)</label>
            <input
              className="input"
              type="text"
              placeholder="Brief description of your contract"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
            />
          </div>
        </div>

        {/* File Upload Zone */}
        <div className="form-section">
          <label className="input-label">
            <HiOutlineCodeBracket style={{ verticalAlign: 'middle', marginRight: 6 }} />
            Solidity Contracts
          </label>

          <div
            className={`drop-zone ${contracts.length > 0 ? 'has-file' : ''}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => document.getElementById('sol-file-input')?.click()}
          >
            <input
              id="sol-file-input"
              type="file"
              accept=".sol"
              multiple
              style={{ display: 'none' }}
              onChange={(e) => {
                if (e.target.files) handleFileSelect(e.target.files);
              }}
            />
            <div className="drop-zone-empty">
              <HiOutlineDocumentArrowUp className="drop-zone-icon" />
              <span className="drop-zone-text">Drop <strong>.sol</strong> files here</span>
              <span className="drop-zone-hint">or click to browse multiple</span>
            </div>
          </div>
        </div>

        {/* Contract List & Editor */}
        {contracts.length > 0 && (
          <div className="contract-setup-container">
            <div className="contract-list-sidebar">
              {contracts.map(c => (
                <div 
                  key={c.id} 
                  className={`contract-item ${activeContractId === c.id ? 'active' : ''}`}
                  onClick={() => setActiveContractId(c.id)}
                >
                  <span className="contract-item-name">{c.name}</span>
                  <button 
                    type="button" 
                    className="contract-item-remove"
                    onClick={(e) => { e.stopPropagation(); handleRemoveContract(c.id); }}
                  >
                    <HiOutlineXMark />
                  </button>
                </div>
              ))}
              <button 
                type="button" 
                className="btn-add-manual"
                onClick={() => {
                  const id = Math.random().toString(36).substring(2, 9);
                  const newC = { id, name: 'NewContract', soliditySource: 'pragma solidity ^0.8.20;\n\ncontract NewContract {\n\n}' };
                  setContracts([...contracts, newC]);
                  setActiveContractId(id);
                }}
              >
                <HiOutlinePlusCircle /> Add More
              </button>
            </div>

            <div className="contract-editor-main">
              {activeContractId && (
                <>
                   <div className="editor-header">
                    <input 
                      className="contract-name-input"
                      value={contracts.find(c => c.id === activeContractId)?.name || ''}
                      onChange={(e) => handleUpdateActiveName(e.target.value)}
                      placeholder="Contract Name"
                    />
                    <span className="char-count">
                      ({contracts.find(c => c.id === activeContractId)?.soliditySource.length || 0} chars)
                    </span>
                  </div>
                  <textarea
                    className="input source-textarea"
                    value={contracts.find(c => c.id === activeContractId)?.soliditySource || ''}
                    onChange={(e) => handleUpdateActiveSource(e.target.value)}
                    rows={15}
                    spellCheck={false}
                  />
                </>
              )}
            </div>
          </div>
        )}

        {/* Empty state manual add */}
        {contracts.length === 0 && (
          <div className="form-section center-add">
            <button 
              type="button" 
              className="btn btn-ghost"
              onClick={() => {
                const id = Math.random().toString(36).substring(2, 9);
                setContracts([{ id, name: 'MyContract', soliditySource: 'pragma solidity ^0.8.20;\n\ncontract MyContract {\n\n}' }]);
                setActiveContractId(id);
              }}
            >
              <HiOutlinePlusCircle /> Or start with a blank contract
            </button>
          </div>
        )}

        {/* Submit */}
        <div className="form-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate('/projects')}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary btn-lg"
            disabled={isSubmitting || contracts.length === 0 || !walletId}
          >
            {isSubmitting ? (
              <><span className="spinner" /> Creating...</>
            ) : (
              <><HiOutlinePlusCircle /> Create Project</>
            )}
          </button>
        </div>
      </form>
    </PageWrapper>
  );
}
