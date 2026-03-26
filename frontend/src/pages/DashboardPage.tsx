import { Link } from 'react-router-dom';
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
import './DashboardPage.css';

export default function DashboardPage() {
  // TODO: Phase 1 — fetch real data from API
  const stats = {
    wallets: 0,
    projects: 0,
    transactions: 0,
  };

  return (
    <PageWrapper title="Dashboard" subtitle="Overview of your SContract workspace">
      {/* Stats */}
      <div className="dashboard-stats">
        <div className="stat-card">
          <div className="stat-icon purple">
            <HiOutlineWallet />
          </div>
          <div className="stat-info">
            <h3>Wallets</h3>
            <div className="stat-value">{stats.wallets}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon green">
            <HiOutlineFolder />
          </div>
          <div className="stat-info">
            <h3>Projects</h3>
            <div className="stat-value">{stats.projects}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon blue">
            <HiOutlineClock />
          </div>
          <div className="stat-info">
            <h3>Transactions</h3>
            <div className="stat-value">{stats.transactions}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon orange">
            <HiOutlineCpuChip />
          </div>
          <div className="stat-info">
            <h3>Network</h3>
            <div className="stat-value" style={{ fontSize: 'var(--font-size-lg)' }}>BSC Testnet</div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--space-4)' }}>
        Quick Actions
      </h2>
      <div className="dashboard-quick-actions">
        <Link to="/projects/create" className="quick-action-card">
          <div className="quick-action-icon"><HiOutlinePlusCircle /></div>
          <h3>New Project</h3>
          <p>Deploy a smart contract</p>
        </Link>

        <Link to="/explore" className="quick-action-card">
          <div className="quick-action-icon"><HiOutlineGlobeAlt /></div>
          <h3>Explore</h3>
          <p>Browse deployed contracts</p>
        </Link>

        <Link to="/wallets" className="quick-action-card">
          <div className="quick-action-icon"><HiOutlineWallet /></div>
          <h3>Manage Wallets</h3>
          <p>Create & fund wallets</p>
        </Link>

        <Link to="/transactions" className="quick-action-card">
          <div className="quick-action-icon"><HiOutlineBeaker /></div>
          <h3>Transaction History</h3>
          <p>View past transactions</p>
        </Link>
      </div>
    </PageWrapper>
  );
}
