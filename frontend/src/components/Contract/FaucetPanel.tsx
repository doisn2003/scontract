import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ethers } from 'ethers';
import { 
  HiOutlineBeaker,
  HiOutlineCheck,
  HiOutlineCog6Tooth,
  HiOutlineBolt
} from 'react-icons/hi2';
import api from '../../services/api';
import type { SmartContract, IFaucetConfig } from '../../types';
import toast from 'react-hot-toast';
import './FaucetPanel.css';

interface FaucetPanelProps {
  projectId: string;
  contract: SmartContract;
  isDevConfig: boolean;
  onUpdate: () => void;
  devAddress?: string;
}

export default function FaucetPanel({ projectId, contract, isDevConfig, onUpdate, devAddress }: FaucetPanelProps) {
  const { t } = useTranslation();
  const config = contract.faucetConfig || {
    isEnabled: false,
    tokenType: 'UNKNOWN',
    amountPerRequest: '0',
    cooldownHours: 24,
    maxTotalDrained: '0',
    mintFunctionName: 'mint',
    faucetTokenId: ''
  };

  // Dev state
  const [isSaving, setIsSaving] = useState(false);
  const [devConfig, setDevConfig] = useState<IFaucetConfig>(config);

  // User state
  const [targetAddress, setTargetAddress] = useState('');
  const [isClaiming, setIsClaiming] = useState(false);

  // Balance state
  const [devBalance, setDevBalance] = useState<string | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);

  // Sync state if contract updates from parent
  useEffect(() => {
    if (contract.faucetConfig) {
      setDevConfig({ ...config, ...contract.faucetConfig });
    }
  }, [contract.faucetConfig]);

  useEffect(() => {
    if (isDevConfig && contract.status === 'deployed' && devAddress && config.tokenType !== 'UNKNOWN' && contract.contractAddress && contract.abi) {
      const fetchBalance = async () => {
        setIsLoadingBalance(true);
        try {
          const rpcUrl = 'https://data-seed-prebsc-1-s1.bnbchain.org:8545/';
          const provider = new ethers.JsonRpcProvider(rpcUrl);
          const ethersContract = new ethers.Contract(contract.contractAddress!, contract.abi!, provider);
          
          let bal;
          if (config.tokenType === 'ERC20' || config.tokenType === 'ERC721') {
            bal = await ethersContract.balanceOf(devAddress);
          } else if (config.tokenType === 'ERC1155') {
            if (config.faucetTokenId) {
              bal = await ethersContract.balanceOf(devAddress, config.faucetTokenId);
            }
          }
          
          if (bal !== undefined) {
            if (config.tokenType === 'ERC20') {
              let decimals = 18;
              try { decimals = await ethersContract.decimals(); } catch(e){}
              setDevBalance(ethers.formatUnits(bal, decimals));
            } else {
              setDevBalance(bal.toString());
            }
          }
        } catch (err) {
          console.log('Balance fetch skipped or failed', err);
        } finally {
          setIsLoadingBalance(false);
        }
      };
      
      // Delay fetching slightly to avoid spamming or if ABI takes a sec
      const tId = setTimeout(fetchBalance, 500);
      return () => clearTimeout(tId);
    }
  }, [isDevConfig, contract.status, contract.contractAddress, devAddress, config.tokenType, config.faucetTokenId]);

  const handleSaveConfig = async () => {
    setIsSaving(true);
    try {
      const res = await api.patch(`/projects/${projectId}/contracts/${contract._id}`, {
        faucetConfig: devConfig
      });
      if (res.data?.success) {
        toast.success(t('pages.interact.faucet.toast_save_success'));
        onUpdate();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || t('pages.interact.faucet.toast_save_fail'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleClaim = async () => {
    if (!targetAddress) {
      toast.error(t('pages.interact.faucet.toast_claim_address_req'));
      return;
    }
    setIsClaiming(true);
    try {
      const res = await api.post(`/projects/${projectId}/contracts/${contract._id}/faucet`, {
        targetAddress
      });
      if (res.data?.success) {
        toast.success(res.data.message || 'Tokens sent successfully! Check your wallet.');
        setTargetAddress('');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Faucet request failed');
    } finally {
      setIsClaiming(false);
    }
  };

  if (!isDevConfig) {
    if (!config.isEnabled || config.tokenType === 'UNKNOWN') return null;
    
    return (
      <div className="faucet-hero-container animate-fade-in">
        <div className="faucet-hero-header">
          <h2 className="faucet-hero-title">
            <HiOutlineBeaker /> {t('pages.interact.faucet.claim_title', { name: contract.name })}
          </h2>
          <p className="faucet-hero-desc" dangerouslySetInnerHTML={{
            __html: t('pages.interact.faucet.claim_desc', { amount: config.amountPerRequest, token: config.tokenType })
          }} />
        </div>
        <div className="faucet-hero-action">
          <input 
            type="text" 
            className="input faucet-hero-target" 
            placeholder={t('pages.interact.faucet.target_placeholder')}
            value={targetAddress}
            onChange={(e) => setTargetAddress(e.target.value)}
          />
          <button 
            className="faucet-btn" 
            onClick={handleClaim}
            disabled={isClaiming || !targetAddress}
          >
            {isClaiming ? <span className="spinner" style={{width: 18, height: 18}}></span> : <HiOutlineBolt size={20} />}
            {isClaiming ? t('pages.interact.faucet.claiming') : t('pages.interact.faucet.claim_btn')}
          </button>
        </div>
      </div>
    );
  }

  // Dev Config Mode
  return (
    <div className="faucet-config-container animate-fade-in">
      <div className="faucet-config-header">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <h3 className="faucet-config-title">
            <HiOutlineBeaker /> {t('pages.interact.faucet.title')}
          </h3>
          {devAddress && (
             <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginLeft: 28 }}>
               {t('pages.interact.faucet.source_wallet')} <strong>{devAddress.slice(0,6)}...{devAddress.slice(-4)}</strong>
               {devBalance !== null ? (
                 <span style={{ marginLeft: 8 }} className="badge badge-success">
                   {t('pages.interact.faucet.balance')} {devBalance} {config.tokenType}
                 </span>
               ) : isLoadingBalance ? (
                 <span style={{ marginLeft: 8, fontStyle: 'italic' }}>{t('pages.interact.faucet.loading_balance')}</span>
               ) : null}
             </div>
          )}
        </div>
        {config.tokenType !== 'UNKNOWN' && (
          <span className="config-type-badge">{config.tokenType} {t('pages.interact.faucet.detected')}</span>
        )}
      </div>

      {contract.status !== 'deployed' ? (
        <div className="alert alert-warning">
          {t('pages.interact.faucet.deploy_warning')}
        </div>
      ) : config.tokenType === 'UNKNOWN' ? (
        <div className="alert alert-warning">
          {t('pages.interact.faucet.unknown_warning')}
        </div>
      ) : (
        <div className="faucet-config-body">
          <label className="toggle-switch" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <input 
              type="checkbox" 
              checked={devConfig.isEnabled}
              onChange={(e) => setDevConfig({...devConfig, isEnabled: e.target.checked})}
            />
            <span className="toggle-slider"></span>
            <span style={{ fontWeight: 600 }}>{t('pages.interact.faucet.enable')}</span>
          </label>

          <div className="config-grid">
            <div className="config-field">
              <label className="config-label">{t('pages.interact.faucet.amount_per_request')}</label>
              <input 
                type="text" 
                className="input" 
                value={devConfig.amountPerRequest}
                onChange={(e) => setDevConfig({...devConfig, amountPerRequest: e.target.value})}
                placeholder={config.tokenType === 'ERC20' ? '100' : '1'}
              />
            </div>
            <div className="config-field">
              <label className="config-label">{t('pages.interact.faucet.cooldown')}</label>
              <input 
                type="number" 
                className="input" 
                min="0"
                value={devConfig.cooldownHours}
                onChange={(e) => setDevConfig({...devConfig, cooldownHours: Number(e.target.value)})}
              />
            </div>
          </div>

          {(config.tokenType === 'ERC721' || config.tokenType === 'ERC1155') && (
            <div className="config-grid">
              <div className="config-field">
                <label className="config-label">{t('pages.interact.faucet.mint_fn')}</label>
                <input 
                  type="text" 
                  className="input" 
                  value={devConfig.mintFunctionName}
                  onChange={(e) => setDevConfig({...devConfig, mintFunctionName: e.target.value})}
                />
              </div>
              {config.tokenType === 'ERC1155' && (
                <div className="config-field">
                  <label className="config-label">{t('pages.interact.faucet.token_id')}</label>
                  <input 
                    type="text" 
                    className="input" 
                    value={devConfig.faucetTokenId || ''}
                    onChange={(e) => setDevConfig({...devConfig, faucetTokenId: e.target.value})}
                  />
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <button 
              className="btn btn-primary" 
              onClick={handleSaveConfig} 
              disabled={isSaving}
            >
              {isSaving ? t('pages.interact.faucet.saving') : <><HiOutlineCheck /> {t('pages.interact.faucet.save_config')}</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
