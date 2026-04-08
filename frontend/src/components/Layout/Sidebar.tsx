import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  HiOutlineSquares2X2,
  HiOutlineWallet,
  HiOutlinePlusCircle,
  HiOutlineFolder,
  HiOutlineGlobeAlt,
  HiOutlineClock,
  HiOutlineArrowRightOnRectangle,
  HiOutlineUsers,
  HiOutlineCog6Tooth,
} from 'react-icons/hi2';
import { useAuth } from '../../context/AuthContext';
import './Sidebar.css';

export default function Sidebar() {
  const { logout, user } = useAuth();
  const { t } = useTranslation();

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `sidebar-link ${isActive ? 'active' : ''}`;

  return (
    <aside className="sidebar">
      <div className="sidebar-section">
        <div className="sidebar-section-title">{t('nav.activity')}</div>
        <nav className="sidebar-nav">
          <NavLink to="/dashboard" className={linkClass}>
            <span className="sidebar-icon"><HiOutlineSquares2X2 /></span>
            {t('nav.dashboard')}
          </NavLink>
          <NavLink to="/wallets" className={linkClass}>
            <span className="sidebar-icon"><HiOutlineWallet /></span>
            {t('nav.wallets')}
          </NavLink>
        </nav>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-title">{t('nav.projects.title')}</div>
        <nav className="sidebar-nav">
          {user?.role !== 'guest' && (
            <>
              <NavLink to="/projects/create" className={linkClass}>
                <span className="sidebar-icon"><HiOutlinePlusCircle /></span>
                {t('nav.projects.new')}
              </NavLink>
              <NavLink to="/projects" className={linkClass}>
                <span className="sidebar-icon"><HiOutlineFolder /></span>
                {t('nav.projects.my_projects')}
              </NavLink>
            </>
          )}
          <NavLink to="/explore" className={linkClass}>
            <span className="sidebar-icon"><HiOutlineGlobeAlt /></span>
            {t('nav.projects.explore')}
          </NavLink>
        </nav>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-title">{t('nav.activity')}</div>
        <nav className="sidebar-nav">
          <NavLink to="/transactions" className={linkClass}>
            <span className="sidebar-icon"><HiOutlineClock /></span>
            {t('nav.transactions')}
          </NavLink>
        </nav>
      </div>

      {user?.role === 'admin' && (
        <div className="sidebar-section">
          <div className="sidebar-section-title">{t('nav.admin.title')}</div>
          <nav className="sidebar-nav">
            <NavLink to="/admin/users" className={linkClass} title={t('nav.admin.users')}>
              <span className="sidebar-icon"><HiOutlineUsers /></span>
              {t('nav.admin.users')}
            </NavLink>
            <NavLink to="/admin/configs" className={linkClass} title={t('nav.admin.configs')}>
              <span className="sidebar-icon"><HiOutlineCog6Tooth /></span>
              {t('nav.admin.configs')}
            </NavLink>
          </nav>
        </div>
      )}

      <div className="sidebar-spacer" />

      <div className="sidebar-footer">
        <button className="sidebar-link" onClick={logout} style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer' }}>
          <span className="sidebar-icon"><HiOutlineArrowRightOnRectangle /></span>
          {t('nav.logout')}
        </button>
      </div>
    </aside>
  );
}

