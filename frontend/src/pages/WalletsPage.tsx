import { useState, useEffect, useCallback } from 'react';
import {
  HiOutlineWallet,
  HiOutlinePlusCircle,
  HiOutlineKey,
  HiOutlineDocumentDuplicate,
  HiOutlineArrowPath,
  HiOutlineEye,
  HiOutlineXMark,
} from 'react-icons/hi2';
import toast from 'react-hot-toast';
import PageWrapper from '../components/Layout/PageWrapper';
import api from '../services/api';
import type { Wallet, ApiResponse } from '../types';
import FaucetButton from '../components/Wallet/FaucetButton';
import './WalletsPage.css';

export default function WalletsPage() {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [balances, setBalances] = useState<Record<string, string>>({});
  const [balanceLoading, setBalanceLoading] = useState<Record<string, boolean>>({});

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPKModal, setShowPKModal] = useState(false);
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(null);
  const [privateKey, setPrivateKey] = useState<string | null>(null);
  const [pkLoading, setPKLoading] = useState(false);

  // Create wallet form
  const [newWalletLabel, setNewWalletLabel] = useState('');
  const [createLoading, setCreateLoading] = useState(false);

  // Fetch wallets
  const fetchWallets = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data } = await api.get<ApiResponse<Wallet[]>>('/wallets');
      if (data.success && data.data) {
        setWallets(data.data);
      }
    } catch {
      toast.error('Failed to load wallets');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWallets();
  }, [fetchWallets]);

  // Fetch balance for a wallet
  const fetchBalance = async (walletId: string) => {
    setBalanceLoading(prev => ({ ...prev, [walletId]: true }));
    try {
      const { data } = await api.get<ApiResponse<{ balance: string }>>(`/wallets/${walletId}/balance`);
      if (data.success && data.data) {
        setBalances(prev => ({ ...prev, [walletId]: data.data!.balance }));
      }
    } catch {
      toast.error('Failed to fetch balance');
    } finally {
      setBalanceLoading(prev => ({ ...prev, [walletId]: false }));
    }
  };

  // Create wallet
  const handleCreateWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLoading(true);
    try {
      const { data } = await api.post<ApiResponse<Wallet>>('/wallets', {
        label: newWalletLabel || 'My Wallet',
        walletType: 'user',
      });
      if (data.success && data.data) {
        toast.success('Wallet created successfully!');
        setShowCreateModal(false);
        setNewWalletLabel('');
        fetchWallets();
      }
    } catch {
      toast.error('Failed to create wallet');
    } finally {
      setCreateLoading(false);
    }
  };

  // Show private key
  const handleShowPK = async (walletId: string) => {
    setSelectedWalletId(walletId);
    setShowPKModal(true);
    setPKLoading(true);
    setPrivateKey(null);

    try {
      const { data } = await api.get<ApiResponse<{ privateKey: string }>>(`/wallets/${walletId}/private-key`);
      if (data.success && data.data) {
        setPrivateKey(data.data.privateKey);
      }
    } catch {
      toast.error('Failed to retrieve private key');
      setShowPKModal(false);
    } finally {
      setPKLoading(false);
    }
  };

  // Copy to clipboard
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied!`);
  };

  return (
    <PageWrapper
      title="Wallets"
      subtitle="Manage your Web3 wallets — create, fund, and import into MetaMask"
    >
      <div className="wallets-page">
        {/* Header with create button */}
        <div className="wallets-header">
          <span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
            {wallets.length} wallet{wallets.length !== 1 ? 's' : ''}
          </span>
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            <HiOutlinePlusCircle /> New Wallet
          </button>
        </div>

        {/* Wallet Grid */}
        {isLoading ? (
          <div className="wallets-grid">
            {[1, 2].map(i => (
              <div key={i} className="wallet-card">
                <div className="skeleton" style={{ height: 36, width: '60%', marginBottom: 16 }} />
                <div className="skeleton" style={{ height: 40, marginBottom: 16 }} />
                <div className="skeleton" style={{ height: 32, width: '40%', marginBottom: 20 }} />
                <div className="skeleton" style={{ height: 36 }} />
              </div>
            ))}
          </div>
        ) : wallets.length === 0 ? (
          <div className="card wallets-empty">
            <div className="wallets-empty-icon">💼</div>
            <h3>No wallets yet</h3>
            <p>Create your first wallet to get started with smart contract testing.</p>
            <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
              <HiOutlinePlusCircle /> Create Wallet
            </button>
          </div>
        ) : (
          <div className="wallets-grid">
            {wallets.map((wallet) => (
              <div key={wallet._id} className="wallet-card">
                {/* Card Header */}
                <div className="wallet-card-header">
                  <div className="wallet-card-label">
                    <div className="wallet-icon"><HiOutlineWallet /></div>
                    <span>{wallet.label}</span>
                  </div>
                  <span className={`badge ${wallet.walletType === 'owner' ? 'badge-accent' : 'badge-info'}`}>
                    {wallet.walletType}
                  </span>
                </div>

                {/* Address */}
                <div className="wallet-address-row">
                  <span className="wallet-address">{wallet.address}</span>
                  <button
                    className="copy-btn"
                    onClick={() => copyToClipboard(wallet.address, 'Address')}
                    title="Copy address"
                  >
                    <HiOutlineDocumentDuplicate />
                  </button>
                </div>

                {/* Balance */}
                <div className="wallet-balance-row">
                  {balances[wallet._id] !== undefined ? (
                    <>
                      <span className="wallet-balance-value">
                        {parseFloat(balances[wallet._id]!).toFixed(4)}
                      </span>
                      <span className="wallet-balance-unit">BNB</span>
                    </>
                  ) : balanceLoading[wallet._id] ? (
                    <div className="skeleton wallet-balance-loading" />
                  ) : (
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => fetchBalance(wallet._id)}
                    >
                      <HiOutlineArrowPath /> Check Balance
                    </button>
                  )}
                </div>

                {/* Actions */}
                <div className="wallet-card-actions">
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleShowPK(wallet._id)}
                    title="View Private Key"
                  >
                    <HiOutlineKey /> PK
                  </button>
                  
                  <FaucetButton 
                    address={wallet.address} 
                    onSuccess={() => fetchBalance(wallet._id)} 
                  />

                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => fetchBalance(wallet._id)}
                    title="Check Balance"
                  >
                    <HiOutlineArrowPath />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Wallet Modal */}
        {showCreateModal && (
          <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                <h2 className="modal-title">Create New Wallet</h2>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowCreateModal(false)}>
                  <HiOutlineXMark />
                </button>
              </div>
              <p className="modal-description">
                A new wallet with a random private key will be generated. You can import it into MetaMask later.
              </p>
              <form className="create-wallet-form" onSubmit={handleCreateWallet}>
                <div className="auth-field">
                  <label className="input-label" htmlFor="wallet-label">Wallet Label</label>
                  <input
                    id="wallet-label"
                    className="input"
                    type="text"
                    placeholder="e.g., Testing Wallet"
                    value={newWalletLabel}
                    onChange={(e) => setNewWalletLabel(e.target.value)}
                    maxLength={30}
                  />
                </div>
                <div className="modal-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={createLoading}>
                    {createLoading ? <span className="spinner" /> : 'Create Wallet'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Private Key Modal */}
        {showPKModal && (
          <div className="modal-overlay" onClick={() => { setShowPKModal(false); setPrivateKey(null); }}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                <h2 className="modal-title">
                  <HiOutlineEye style={{ verticalAlign: 'middle', marginRight: 8 }} />
                  Private Key
                </h2>
                <button className="btn btn-ghost btn-sm" onClick={() => { setShowPKModal(false); setPrivateKey(null); }}>
                  <HiOutlineXMark />
                </button>
              </div>
              <div className="modal-warning">
                ⚠️ <strong>Never share your private key!</strong> Anyone with this key has full control of this wallet.
                Copy this key and import it into MetaMask to sign transactions.
              </div>

              {pkLoading ? (
                <div className="skeleton" style={{ height: 60, marginBottom: 20 }} />
              ) : privateKey ? (
                <div className="pk-display">{privateKey}</div>
              ) : null}

              <div className="modal-actions">
                {privateKey && (
                  <button
                    className="btn btn-primary"
                    onClick={() => copyToClipboard(privateKey, 'Private Key')}
                  >
                    <HiOutlineDocumentDuplicate /> Copy Key
                  </button>
                )}
                <button
                  className="btn btn-secondary"
                  onClick={() => { setShowPKModal(false); setPrivateKey(null); }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageWrapper>
  );
}
