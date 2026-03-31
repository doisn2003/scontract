import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  HiOutlineCodeBracket,
  HiOutlineDocumentArrowUp,
  HiOutlineWallet,
  HiOutlinePlusCircle,
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
  const [soliditySource, setSoliditySource] = useState('');
  const [fileName, setFileName] = useState('');
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
  const handleFileSelect = (file: File) => {
    if (!file.name.endsWith('.sol')) {
      toast.error('Please select a .sol (Solidity) file');
      return;
    }
    if (file.size > 500 * 1024) {
      toast.error('File too large (max 500KB)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setSoliditySource(content);
      setFileName(file.name);
      // Auto-fill name from filename if empty
      if (!name) {
        setName(file.name.replace('.sol', ''));
      }
      toast.success(`Loaded ${file.name}`);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
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
    if (!soliditySource.trim()) {
      toast.error('Please upload a Solidity file or paste source code');
      return;
    }
    if (!soliditySource.includes('pragma solidity')) {
      toast.error('Invalid Solidity: missing pragma statement');
      return;
    }

    setIsSubmitting(true);
    try {
      const { data } = await api.post<ApiResponse<Project>>('/projects', {
        walletId,
        name: name || 'Untitled Project',
        description,
        soliditySource,
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
            Solidity Source Code
          </label>

          <div
            className={`drop-zone ${soliditySource ? 'has-file' : ''}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => document.getElementById('sol-file-input')?.click()}
          >
            <input
              id="sol-file-input"
              type="file"
              accept=".sol"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileSelect(file);
              }}
            />
            {soliditySource ? (
              <div className="drop-zone-loaded">
                <HiOutlineDocumentArrowUp className="drop-zone-icon loaded" />
                <span className="drop-zone-filename">{fileName || 'Source loaded'}</span>
                <span className="drop-zone-hint">Click or drop to replace</span>
              </div>
            ) : (
              <div className="drop-zone-empty">
                <HiOutlineDocumentArrowUp className="drop-zone-icon" />
                <span className="drop-zone-text">Drop your <strong>.sol</strong> file here</span>
                <span className="drop-zone-hint">or click to browse</span>
              </div>
            )}
          </div>
        </div>

        {/* Source Code Preview / Textarea */}
        <div className="form-section">
          <label className="input-label">
            Source Preview {soliditySource && <span className="char-count">({soliditySource.length} chars)</span>}
          </label>
          <textarea
            className="input source-textarea"
            placeholder="// SPDX-License-Identifier: MIT&#10;pragma solidity ^0.8.20;&#10;&#10;contract MyContract {&#10;    // ...&#10;}"
            value={soliditySource}
            onChange={(e) => setSoliditySource(e.target.value)}
            rows={12}
            spellCheck={false}
          />
        </div>

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
            disabled={isSubmitting || !soliditySource.trim() || !walletId}
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
