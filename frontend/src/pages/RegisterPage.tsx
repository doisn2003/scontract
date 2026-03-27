import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { HiOutlineCube } from 'react-icons/hi2';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import './AuthPage.css';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = await register({ name, email, password });
      if (result.walletAddress) {
        toast.success(`Wallet created: ${result.walletAddress.slice(0, 8)}...${result.walletAddress.slice(-6)}`, {
          duration: 6000,
        });
      }
      toast.success('Registration successful!');
      navigate('/dashboard');
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { message?: string } } };
        setError(axiosErr.response?.data?.message || 'Registration failed');
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Registration failed');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-header">
          <div className="auth-logo">
            <HiOutlineCube />
          </div>
          <h1 className="auth-title">Create account</h1>
          <p className="auth-subtitle">Get started with SContract — your Web3 BaaS platform</p>
        </div>

        <div className="auth-card">
          <form className="auth-form" onSubmit={handleSubmit}>
            {error && <div className="auth-error">{error}</div>}

            <div className="auth-field">
              <label className="input-label" htmlFor="register-name">Full Name</label>
              <input
                id="register-name"
                className="input"
                type="text"
                placeholder="Nguyen Van A"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>

            <div className="auth-field">
              <label className="input-label" htmlFor="register-email">Email</label>
              <input
                id="register-email"
                className="input"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>

            <div className="auth-field">
              <label className="input-label" htmlFor="register-password">Password</label>
              <input
                id="register-password"
                className="input"
                type="password"
                placeholder="Min 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                disabled={isLoading}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary auth-submit"
              disabled={isLoading}
            >
              {isLoading ? <span className="spinner" /> : 'Create Account'}
            </button>
          </form>
        </div>

        <div className="auth-footer">
          Already have an account? <Link to="/login">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
