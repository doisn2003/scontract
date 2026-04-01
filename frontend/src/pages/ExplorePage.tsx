import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  HiOutlineGlobeAlt,
  HiOutlineRocketLaunch,
} from 'react-icons/hi2';
import toast from 'react-hot-toast';
import PageWrapper from '../components/Layout/PageWrapper';
import api from '../services/api';
import type { ApiResponse } from '../types';
import './ExplorePage.css';

import ProjectCard from '../components/Explore/ProjectCard';

interface ExploreProject {
  _id: string;
  name: string;
  description?: string;
  contracts: {
    name: string;
    contractAddress: string | null;
    status: string;
  }[];
  network: string;
  createdAt: string;
  userId: string;
}

export default function ExplorePage() {
  const { t } = useTranslation();
  const [projects, setProjects] = useState<ExploreProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchExplore = async () => {
      try {
        const { data } = await api.get<ApiResponse<ExploreProject[]>>('/explore');
        if (data.success && data.data) {
          setProjects(data.data);
        }
      } catch {
        toast.error('Failed to load deployed projects');
      } finally {
        setIsLoading(false);
      }
    };
    fetchExplore();
  }, []);

  return (
    <PageWrapper title={t('pages.explore.title')} subtitle={t('pages.explore.subtitle')}>
      <div className="explore-page">
        {isLoading ? (
          <div className="explore-grid">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="explore-card" style={{ height: 180 }}>
                <div className="explore-card-header">
                  <div className="skeleton" style={{ height: 20, width: '60%' }} />
                </div>
                <div className="skeleton" style={{ height: 24, marginBottom: 16 }} />
                <div className="skeleton" style={{ height: 28, width: '70%', marginBottom: 16 }} />
                <div className="explore-card-footer">
                  <div className="skeleton" style={{ height: 16, width: '40%' }} />
                </div>
              </div>
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="card explore-empty">
            <div className="explore-empty-icon"><HiOutlineGlobeAlt /></div>
            <h3>No deployed contracts yet</h3>
            <p>Be the first to deploy a smart contract and have it appear here!</p>
            <Link to="/projects/create" className="btn btn-primary">
              <HiOutlineRocketLaunch /> Deploy your first contract
            </Link>
          </div>
        ) : (
          <div className="explore-grid">
            {projects.map(p => (
              <ProjectCard key={p._id} project={p} />
            ))}
          </div>
        )}
      </div>
    </PageWrapper>
  );
}

