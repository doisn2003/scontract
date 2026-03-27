import { NavLink } from 'react-router-dom';
import {
  HiOutlineSquares2X2,
  HiOutlineWallet,
  HiOutlinePlusCircle,
  HiOutlineFolder,
  HiOutlineGlobeAlt,
  HiOutlineClock,
  HiOutlineArrowRightOnRectangle,
} from 'react-icons/hi2';
import { useAuth } from '../../context/AuthContext';
import './Sidebar.css';

export default function Sidebar() {
  const { logout } = useAuth();

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `sidebar-link ${isActive ? 'active' : ''}`;

  return (
    <aside className="sidebar">
      <div className="sidebar-section">
        <div className="sidebar-section-title">Main</div>
        <nav className="sidebar-nav">
          <NavLink to="/dashboard" className={linkClass}>
            <span className="sidebar-icon"><HiOutlineSquares2X2 /></span>
            Dashboard
          </NavLink>
          <NavLink to="/wallets" className={linkClass}>
            <span className="sidebar-icon"><HiOutlineWallet /></span>
            Wallets
          </NavLink>
        </nav>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-title">Projects</div>
        <nav className="sidebar-nav">
          <NavLink to="/projects/create" className={linkClass}>
            <span className="sidebar-icon"><HiOutlinePlusCircle /></span>
            New Project
          </NavLink>
          <NavLink to="/projects" className={linkClass}>
            <span className="sidebar-icon"><HiOutlineFolder /></span>
            My Projects
          </NavLink>
          <NavLink to="/explore" className={linkClass}>
            <span className="sidebar-icon"><HiOutlineGlobeAlt /></span>
            Explore
          </NavLink>
        </nav>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-title">Activity</div>
        <nav className="sidebar-nav">
          <NavLink to="/transactions" className={linkClass}>
            <span className="sidebar-icon"><HiOutlineClock /></span>
            Transactions
          </NavLink>
        </nav>
      </div>

      <div className="sidebar-spacer" />

      <div className="sidebar-footer">
        <button className="sidebar-link" onClick={logout} style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer' }}>
          <span className="sidebar-icon"><HiOutlineArrowRightOnRectangle /></span>
          Logout
        </button>
      </div>
    </aside>
  );
}
