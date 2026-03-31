import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  HiOutlineWallet,
  HiOutlineFolder,
  HiOutlineClock,
  HiOutlinePlusCircle,
  HiOutlineGlobeAlt,
  HiOutlineBeaker,
  HiOutlineCpuChip,
} from 'react-icons/hi2';
import PageWrapper from '../components/Layout/PageWrapper';
import api from '../services/api';
import type { ApiResponse, Wallet, Project } from '../types';
import './DashboardPage.css';

export default function DashboardPage() {
  const { t } = useTranslation();
  const [walletCount, setWalletCount] = useState(0);
  const [projectCount, setProjectCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [walletsRes, projectsRes] = await Promise.all([
          api.get<ApiResponse<Wallet[]>>('/wallets'),
          api.get<ApiResponse<Project[]>>('/projects'),
        ]);
        if (walletsRes.data.success && walletsRes.data.data) {
          setWalletCount(walletsRes.data.data.length);
        }
        if (projectsRes.data.success && projectsRes.data.data) {
          setProjectCount(projectsRes.data.data.length);
        }
      } catch {
        // silent fail
      } finally {
        setIsLoading(false);
      }
    };
    fetchStats();
  }, []);

  return (
    <PageWrapper title={t('nav.dashboard')} subtitle={t('pages.dashboard.subtitle')}>
      {/* Stats */}

      <div className="dashboard-stats">
        <div className="stat-card">
          <div className="stat-icon purple">
            <HiOutlineWallet />
          </div>
          <div className="stat-info">
            <h3>{t('dashboard.stats.wallets')}</h3>
            <div className="stat-value">
              {isLoading ? <div className="skeleton" style={{ width: 40, height: 36 }} /> : walletCount}
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon green">
            <HiOutlineFolder />
          </div>
          <div className="stat-info">
            <h3>{t('dashboard.stats.projects')}</h3>
            <div className="stat-value">
              {isLoading ? <div className="skeleton" style={{ width: 40, height: 36 }} /> : projectCount}
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon blue">
            <HiOutlineClock />
          </div>
          <div className="stat-info">
            <h3>{t('dashboard.stats.transactions')}</h3>
            <div className="stat-value">0</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon orange">
            <HiOutlineCpuChip />
          </div>
          <div className="stat-info">
            <h3>{t('dashboard.stats.network')}</h3>
            <div className="stat-value" style={{ fontSize: 'var(--font-size-lg)' }}>BSC Testnet</div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--space-4)' }}>
        {t('dashboard.quick_actions.title')}
      </h2>
      <div className="dashboard-quick-actions">
        <Link to="/projects/create" className="quick-action-card">
          <div className="quick-action-icon"><HiOutlinePlusCircle /></div>
          <h3>{t('dashboard.quick_actions.new_project.title')}</h3>
          <p>{t('dashboard.quick_actions.new_project.desc')}</p>
        </Link>

        <Link to="/explore" className="quick-action-card">
          <div className="quick-action-icon"><HiOutlineGlobeAlt /></div>
          <h3>{t('dashboard.quick_actions.explore.title')}</h3>
          <p>{t('dashboard.quick_actions.explore.desc')}</p>
        </Link>

        <Link to="/wallets" className="quick-action-card">
          <div className="quick-action-icon"><HiOutlineWallet /></div>
          <h3>{t('dashboard.quick_actions.manage_wallets.title')}</h3>
          <p>{t('dashboard.quick_actions.manage_wallets.desc')}</p>
        </Link>

        <Link to="/transactions" className="quick-action-card">
          <div className="quick-action-icon"><HiOutlineBeaker /></div>
          <h3>{t('dashboard.quick_actions.history.title')}</h3>
          <p>{t('dashboard.quick_actions.history.desc')}</p>
        </Link>
      </div>
    </PageWrapper>
  );
}

