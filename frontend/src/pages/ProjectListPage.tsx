import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import {
  HiOutlineFolder,
  HiOutlinePlusCircle,
  HiOutlineCodeBracket,
  HiOutlineRocketLaunch,
  HiOutlineCheckCircle,
} from 'react-icons/hi2';
import toast from 'react-hot-toast';
import PageWrapper from '../components/Layout/PageWrapper';
import api from '../services/api';
import type { ApiResponse, Project, ProjectStatus } from '../types';
import './ProjectListPage.css';

const STATUS_CONFIG: Record<ProjectStatus, { label: string; className: string; icon: React.ReactNode }> = {
  created: { label: 'Created', className: 'badge-info', icon: <HiOutlineFolder /> },
  compiled: { label: 'Compiled', className: 'badge-warning', icon: <HiOutlineCodeBracket /> },
  deployed: { label: 'Deployed', className: 'badge-success', icon: <HiOutlineCheckCircle /> },
};

export default function ProjectListPage() {
  const { t } = useTranslation();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  const fetchProjects = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data } = await api.get<ApiResponse<Project[]>>('/projects');
      if (data.success && data.data) {
        setProjects(data.data);
      }
    } catch {
      toast.error('Failed to load projects');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  return (
    <PageWrapper title={t('pages.projects.list.title')} subtitle={t('pages.projects.list.subtitle')}>
      <div className="projects-page">
        {/* Header */}
        <div className="projects-header">
          <span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
            {projects.length} project{projects.length !== 1 ? 's' : ''}
          </span>
          <Link to="/projects/create" className="btn btn-primary">
            <HiOutlinePlusCircle /> New Project
          </Link>
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="projects-grid">
            {[1, 2, 3].map(i => (
              <div key={i} className="project-card">
                <div className="skeleton" style={{ height: 24, width: '60%', marginBottom: 12 }} />
                <div className="skeleton" style={{ height: 16, width: '80%', marginBottom: 20 }} />
                <div className="skeleton" style={{ height: 32, width: '30%' }} />
              </div>
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="card projects-empty">
            <div className="projects-empty-icon">📄</div>
            <h3>No projects yet</h3>
            <p>Upload a Solidity file to compile and deploy your first smart contract.</p>
            <Link to="/projects/create" className="btn btn-primary">
              <HiOutlinePlusCircle /> Create Project
            </Link>
          </div>
        ) : (
          <div className="projects-grid">
            {projects.map((project) => {
              const statusCfg = STATUS_CONFIG[project.status];
              return (
                <div
                  key={project._id}
                  className="project-card"
                  onClick={() => navigate(`/projects/${project._id}`)}
                  role="button"
                  tabIndex={0}
                >
                  <div className="project-card-top">
                    <h3 className="project-card-name">{project.name}</h3>
                    <span className={`badge ${statusCfg.className}`}>
                      {statusCfg.icon} {statusCfg.label}
                    </span>
                  </div>

                  {project.description && (
                    <p className="project-card-desc">{project.description}</p>
                  )}

                  <div className="project-card-meta">
                    {project.solidityVersion && (
                      <span className="project-meta-item">
                        <HiOutlineCodeBracket /> Solidity {project.solidityVersion}
                      </span>
                    )}
                    <span className="project-meta-item">
                      {project.network}
                    </span>
                  </div>

                  {project.contractAddress && (
                    <div className="project-card-address mono">
                      <HiOutlineRocketLaunch />
                      {project.contractAddress.slice(0, 10)}...{project.contractAddress.slice(-8)}
                    </div>
                  )}

                  <div className="project-card-date">
                    {new Date(project.createdAt).toLocaleDateString('vi-VN')}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </PageWrapper>
  );
}
