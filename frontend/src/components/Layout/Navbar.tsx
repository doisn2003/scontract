import { Link } from 'react-router-dom';
import { HiOutlineCube } from 'react-icons/hi2';
import MetaMaskButton from '../MetaMask/MetaMaskButton';
import './Navbar.css';

interface NavbarProps {
  userName?: string;
}

export default function Navbar({ userName }: NavbarProps) {
  const initials = userName
    ? userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  return (
    <nav className="navbar">
      <Link to="/dashboard" className="navbar-brand">
        <div className="navbar-logo">
          <HiOutlineCube />
        </div>
        <div className="navbar-title">
          S<span>Contract</span>
        </div>
      </Link>

      <div className="navbar-actions">
        <MetaMaskButton />
        {userName && (
          <div className="navbar-user">
            <div className="navbar-avatar">{initials}</div>
            <span>{userName}</span>
          </div>
        )}
      </div>
    </nav>
  );
}
