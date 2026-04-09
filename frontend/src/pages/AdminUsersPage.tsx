import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  HiOutlineUsers, 
  HiOutlineMagnifyingGlass, 
  HiOutlineChevronLeft, 
  HiOutlineChevronRight
} from 'react-icons/hi2';
import api from '../services/api';
import toast from 'react-hot-toast';
import type { User, ApiResponse } from '../types';
import PageWrapper from '../components/Layout/PageWrapper';
import { useAuth } from '../context/AuthContext';
import './AdminUsersPage.css';

interface PaginationInfo {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export default function AdminUsersPage() {
  const { t } = useTranslation();
  const { user: currentAdmin } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);

  // States for search and pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [roleFilter, setRoleFilter] = useState('');
  const LIMIT = 6;

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    fetchUsers();
  }, [currentPage, roleFilter, debouncedSearch]); // Fetch on page, filter or debounced search change

  // Reset page when search or filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, roleFilter]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await api.get<ApiResponse<{ users: User[], pagination: PaginationInfo }>>('/admin/users', {
        params: {
          page: currentPage,
          limit: LIMIT,
          search: debouncedSearch,
          role: roleFilter
        }
      });
      if (res.data?.success && res.data.data) {
        setUsers(res.data.data.users);
        setPagination(res.data.data.pagination);
      }
    } catch (err: any) {
      toast.error(t('common.error_fetch'));
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDebouncedSearch(searchTerm);
    fetchUsers();
  };

  const handleRoleChange = async (id: string, role: string) => {
    try {
      const res = await api.put(`/admin/users/${id}/role`, { role });
      if (res.data?.success) {
        toast.success(t('admin.users.role_updated'));
        setUsers(prev => prev.map(u => u._id === id ? { ...u, role: role as any } : u));
      }
    } catch {
      toast.error(t('admin.users.role_update_failed'));
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      const res = await api.put(`/admin/users/${id}/status`, { status });
      if (res.data?.success) {
        toast.success(t('admin.users.status_updated'));
        setUsers(prev => prev.map(u => u._id === id ? { ...u, status: status as any } : u));
      }
    } catch {
      toast.error(t('admin.users.status_update_failed'));
    }
  };

  const getRoleBadgeClass = (role: string) => {
    switch(role) {
      case 'admin': return 'badge-error';
      case 'dev': return 'badge-accent';
      default: return 'badge-info';
    }
  };

  return (
    <PageWrapper
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <HiOutlineUsers />
          {t('admin.users.title')}
        </div>
      }
      subtitle={t('admin.users.subtitle')}
    >
      <div className="admin-users-container">
        {/* Filters & Search Header */}
        <div className="card filters-card">
          <form className="admin-search-bar" onSubmit={handleSearchSubmit}>
            <div className="search-input-wrapper">
              <HiOutlineMagnifyingGlass className="search-icon" />
              <input 
                type="text" 
                placeholder={t('admin.users.search_placeholder')} 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input"
              />
            </div>
            <select 
              className="input role-select-filter" 
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="">{t('admin.users.all_roles')}</option>
              <option value="admin">Admin</option>
              <option value="dev">Developer</option>
              <option value="guest">Guest</option>
            </select>
            <button type="submit" className="btn btn-primary">{t('common.search')}</button>
          </form>
        </div>

        {/* Users Table */}
        <div className="card users-list-card">
          <div className="users-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>{t('admin.users.col_profile')}</th>
                  <th>{t('admin.users.col_contact')}</th>
                  <th>{t('admin.users.col_access')}</th>
                  <th>{t('admin.users.col_status')}</th>
                  <th>{t('admin.users.col_joined')}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array(LIMIT).fill(0).map((_, i) => (
                    <tr key={i}>
                      <td><div className="skeleton" style={{ height: 44, borderRadius: 8 }} /></td>
                      <td><div className="skeleton" style={{ height: 20, width: '80%' }} /></td>
                      <td><div className="skeleton" style={{ height: 32, width: 100 }} /></td>
                      <td><div className="skeleton" style={{ height: 32, width: 100 }} /></td>
                      <td><div className="skeleton" style={{ height: 20, width: 80 }} /></td>
                    </tr>
                  ))
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="empty-state">{t('admin.users.no_users')}</td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user._id}>
                      <td className="user-profile-cell">
                        <div className="user-avatar-mini">
                          {user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <div className="user-info">
                          <span className="user-name">
                            {user.name} 
                            {user._id === currentAdmin?._id && <span className="you-badge">{t('common.you')}</span>}
                          </span>
                          <span className="user-id">ID: {user._id.slice(-8)}</span>
                        </div>
                      </td>
                      <td className="user-email-cell">
                        <span className="mono">{user.email}</span>
                      </td>
                      <td>
                        <div className="role-selector">
                          <span className={`badge ${getRoleBadgeClass(user.role)}`}>{user.role}</span>
                          <select
                            className="select-ghost"
                            value={user.role}
                            onChange={(e) => handleRoleChange(user._id, e.target.value)}
                            disabled={user._id === currentAdmin?._id}
                          >
                            <option value="guest">Guest</option>
                            <option value="dev">Dev</option>
                            <option value="admin">Admin</option>
                          </select>
                        </div>
                      </td>
                      <td>
                        <div className="status-selector">
                          <div className={`status-dot ${user.status === 'active' ? 'active' : 'suspended'}`} />
                          <select
                            className="select-ghost"
                            value={user.status}
                            onChange={(e) => handleStatusChange(user._id, e.target.value)}
                            disabled={user._id === currentAdmin?._id}
                          >
                            <option value="active">Active</option>
                            <option value="suspended">Suspended</option>
                          </select>
                        </div>
                      </td>
                      <td className="joined-date-cell">
                        {new Date(user.createdAt).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {pagination && pagination.pages > 1 && (
            <div className="admin-pagination">
              <span className="pagination-info">
                {t('admin.users.showing')} <strong>{((currentPage - 1) * LIMIT) + 1}</strong> - <strong>{Math.min(currentPage * LIMIT, pagination.total)}</strong> {t('common.of')} <strong>{pagination.total}</strong>
              </span>
              <div className="pagination-buttons">
                <button 
                  className="page-btn" 
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => p - 1)}
                >
                  <HiOutlineChevronLeft /> {t('common.previous')}
                </button>
                <div className="page-numbers">
                  {Array.from({ length: pagination.pages }, (_, i) => i + 1).map(num => (
                    <button 
                      key={num}
                      className={`num-btn ${currentPage === num ? 'active' : ''}`}
                      onClick={() => setCurrentPage(num)}
                    >
                      {num}
                    </button>
                  ))}
                </div>
                <button 
                  className="page-btn" 
                  disabled={currentPage === pagination.pages}
                  onClick={() => setCurrentPage(p => p + 1)}
                >
                  {t('common.next')} <HiOutlineChevronRight />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </PageWrapper>
  );
}

