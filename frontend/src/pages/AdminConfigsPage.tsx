import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  HiOutlineCog, 
  HiOutlinePlus, 
  HiOutlineInformationCircle,
  HiOutlineCheckCircle
} from 'react-icons/hi2';
import api from '../services/api';
import toast from 'react-hot-toast';
import PageWrapper from '../components/Layout/PageWrapper';
import './AdminConfigsPage.css';

interface SystemConfig {
  key: string;
  value: string;
}

const FAUCET_KEYS = ['faucet_native_limit', 'faucet_daily_max'];

export default function AdminConfigsPage() {
  const { t } = useTranslation();
  const [configs, setConfigs] = useState<SystemConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/configs');
      if (res.data?.success) {
        setConfigs(res.data.data.configs);
      }
    } catch {
      toast.error('Failed to fetch configurations');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (key: string, value: string) => {
    try {
      setUpdating(key);
      const res = await api.put('/admin/configs', { key, value });
      if (res.data?.success) {
        toast.success(`Successfully updated ${key}`);
        // Update local state without full fetch for better UX
        setConfigs(prev => prev.map(c => c.key === key ? { ...c, value } : c));
      }
    } catch {
      toast.error('Failed to update system configuration');
    } finally {
      setUpdating(null);
    }
  };

  const handleCreate = async () => {
    if (!newKey.trim() || newValue.trim() === '') {
      toast.error('Key and Value are required');
      return;
    }
    
    // Check if key already exists
    if (configs.some(c => c.key === newKey.trim())) {
      toast.error('This configuration key already exists. Please update the existing one.');
      return;
    }

    try {
      const res = await api.put('/admin/configs', { key: newKey.trim(), value: newValue.trim() });
      if (res.data?.success) {
        toast.success(`New configuration ${newKey} added`);
        setNewKey('');
        setNewValue('');
        fetchConfigs();
      }
    } catch {
      toast.error('Failed to add new configuration');
    }
  };

  return (
    <PageWrapper
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <HiOutlineCog />
          {t('admin.configs.title')}
        </div>
      }
      subtitle={t('admin.configs.subtitle')}
    >
      <div className="admin-configs-container">
        {/* Important Info Card */}
        <div className="config-info-banner">
          <HiOutlineInformationCircle className="info-icon" />
          <div className="info-content">
            <h4>{t('admin.configs.info_title')}</h4>
            <ul>
              <li><strong>faucet_native_limit:</strong> {t('admin.configs.faucet_native_desc')}</li>
              <li><strong>faucet_daily_max:</strong> {t('admin.configs.faucet_daily_desc')}</li>
              <li>{t('admin.configs.change_notice')}</li>
            </ul>
          </div>
        </div>

        {/* Config List */}
        <div className="card configs-card">
          <div className="card-header">
            <h3>{t('admin.configs.active_settings')}</h3>
            <button className="btn btn-ghost btn-sm" onClick={fetchConfigs}>
              {t('admin.configs.refresh')}
            </button>
          </div>

          <div className="configs-table-wrapper">
            <table className="configs-table">
              <thead>
                <tr>
                  <th>{t('admin.configs.col_key')}</th>
                  <th>{t('admin.configs.col_value')}</th>
                  <th>{t('admin.configs.col_status')}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array(3).fill(0).map((_, i) => (
                    <tr key={i}>
                      <td><div className="skeleton" style={{ height: 20, width: '60%' }} /></td>
                      <td><div className="skeleton" style={{ height: 40 }} /></td>
                      <td><div className="skeleton" style={{ height: 20, width: 80 }} /></td>
                    </tr>
                  ))
                ) : configs.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="empty-row">{t('admin.configs.no_configs')}</td>
                  </tr>
                ) : (
                  configs.map((config) => (
                    <tr key={config.key} className={FAUCET_KEYS.includes(config.key) ? 'highlight-row' : ''}>
                      <td className="config-key-cell">
                        <span className="mono">{config.key}</span>
                        {FAUCET_KEYS.includes(config.key) && <span className="tag-faucet">{t('admin.configs.tag_faucet')}</span>}
                      </td>
                      <td className="config-value-cell">
                        <input
                          type="text"
                          className="input config-input"
                          defaultValue={config.value}
                          onBlur={(e) => {
                            if (e.target.value !== config.value) {
                              handleUpdate(config.key, e.target.value);
                            }
                          }}
                          disabled={updating === config.key}
                        />
                      </td>
                      <td className="config-status-cell">
                        {updating === config.key ? (
                          <div className="spinner-small" />
                        ) : (
                          <div className="status-saved">
                            <HiOutlineCheckCircle /> {t('common.saved')}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Add New Config Section */}
        <div className="card add-config-card">
          <div className="card-header">
            <h3><HiOutlinePlus /> {t('admin.configs.add_title')}</h3>
          </div>
          <div className="add-config-form">
            <div className="input-group">
              <label>{t('admin.configs.label_key')}</label>
              <input
                className="input"
                placeholder={t('admin.configs.placeholder_key')}
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
              />
            </div>
            <div className="input-group">
              <label>{t('admin.configs.label_value')}</label>
              <input
                className="input"
                placeholder={t('admin.configs.placeholder_value')}
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
              />
            </div>
            <div className="action-group">
              <button 
                className="btn btn-primary" 
                onClick={handleCreate}
                disabled={!newKey || newValue === ''}
              >
                {t('admin.configs.btn_create')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}


