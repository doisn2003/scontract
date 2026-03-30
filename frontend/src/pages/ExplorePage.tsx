import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  HiOutlineGlobeAlt,
  HiOutlineRocketLaunch,
  HiOutlineArrowTopRightOnSquare,
} from 'react-icons/hi2';
import toast from 'react-hot-toast';
import PageWrapper from '../components/Layout/PageWrapper';
import api from '../services/api';
import type { ApiResponse } from '../types';
import './ExplorePage.css';

interface ExploreProject {
  _id: string;
  name: string;
  description?: string;
  contractAddress: string;
  network: string;
  status: string;
  createdAt: string;
  userId: string;
}

export default function ExplorePage() {
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
    <PageWrapper title="Explore" subtitle="Browse smart contracts deployed on BSC Testnet">
      <div className="explore-page">
        {isLoading ? (
          <div className="explore-grid">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="explore-card">
                <div className="skeleton" style={{ height: 24, width: '60%', marginBottom: 12 }} />
                <div className="skeleton" style={{ height: 16, width: '100%', marginBottom: 16 }} />
                <div className="skeleton" style={{ height: 32 }} />
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
              <div key={p._id} className="explore-card">
                <div className="explore-card-header">
                  <h3>{p.name}</h3>
                  <span className="badge badge-success">Deployed</span>
                </div>

                {p.description && (
                  <p className="explore-card-desc">{p.description}</p>
                )}

                <div className="explore-card-address mono">
                  <HiOutlineRocketLaunch />
                  {p.contractAddress.slice(0, 14)}...{p.contractAddress.slice(-8)}
                </div>

                <div className="explore-card-footer">
                  <span className="explore-card-network">{p.network}</span>
                  <div className="explore-card-links">
                    <a
                      href={`https://testnet.bscscan.com/address/${p.contractAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-ghost btn-sm"
                      title="View on BscScan"
                    >
                      <HiOutlineArrowTopRightOnSquare /> BscScan
                    </a>
                    <Link
                      to={`/projects/${p._id}/interact`}
                      className="btn btn-secondary btn-sm"
                    >
                      Interact
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PageWrapper>
  );
}
