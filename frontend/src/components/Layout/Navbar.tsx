import { Link } from 'react-router-dom';
import { useState } from 'react';
import { HiOutlineSun, HiOutlineMoon, HiOutlineLanguage } from 'react-icons/hi2';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import MetaMaskButton from '../MetaMask/MetaMaskButton';
import './Navbar.css';

interface NavbarProps {
  userName?: string;
}

export default function Navbar({ userName }: NavbarProps) {
  const { i18n } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const { logout } = useAuth();
  const [showLogout, setShowLogout] = useState(false);

  const toggleLanguage = () => {
    const nextLang = i18n.language === 'en' ? 'vi' : 'en';
    i18n.changeLanguage(nextLang);
  };

  const initials = userName
    ? userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';
 
  return (
    <nav className="navbar">
      <Link to="/dashboard" className="navbar-brand">
        <div className="navbar-logo">
          <img src="/favicon.svg" alt="SContract Logo" />
        </div>
        <div className="navbar-title">
          S<span>Contract</span>
        </div>
      </Link>

      <div className="navbar-actions">
        <button 
          className="navbar-tool-btn" 
          onClick={toggleTheme} 
          title={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
        >
          {theme === 'dark' ? <HiOutlineSun /> : <HiOutlineMoon />}
        </button>

        <button 
          className="navbar-tool-btn lang-btn" 
          onClick={toggleLanguage}
          title="Switch Language"
        >
          <HiOutlineLanguage />
          <span>{i18n.language.toUpperCase().slice(0, 2)}</span>
        </button>

        <div className="navbar-divider" />
        
        <MetaMaskButton />
        
        {userName && (
          <div className="navbar-user-container">
            <div className="navbar-user" onClick={() => setShowLogout(!showLogout)}>
              <div className="navbar-avatar">{initials}</div>
              <span>{userName}</span>
            </div>
            
            {showLogout && (
              <div className="navbar-user-dropdown">
                <button 
                  className="logout-btn" 
                  onClick={() => {
                    logout();
                    setShowLogout(false);
                  }}
                >
                  Đăng xuất
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}

