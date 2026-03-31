import { useNavigate, Link } from 'react-router-dom';
import { HiOutlineRocketLaunch, HiOutlineArrowTopRightOnSquare } from 'react-icons/hi2';
import { useTranslation } from 'react-i18next';

interface ProjectCardProps {
  project: {
    _id: string;
    name: string;
    description?: string;
    contractAddress: string;
    network: string;
    status: string;
    createdAt: string;
    userId: string;
  };
}

export default function ProjectCard({ project }: ProjectCardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleCardClick = () => {
    navigate(`/projects/${project._id}`);
  };

  const handleLinkClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div className="explore-card cursor-pointer" onClick={handleCardClick} role="button" tabIndex={0}>
      <div className="explore-card-header">
        <h3>{project.name}</h3>
        <span className="badge badge-success">Deployed</span>
      </div>

      <p className="explore-card-desc">
        {project.description || t('pages.explore.no_desc_fallback')}
      </p>

      <div className="explore-card-address mono">
        <HiOutlineRocketLaunch />
        {project.contractAddress.slice(0, 14)}...{project.contractAddress.slice(-8)}
      </div>

      <div className="explore-card-footer">
        <span className="explore-card-network">{project.network}</span>
        <div className="explore-card-links">
          <a
            href={`https://testnet.bscscan.com/address/${project.contractAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost btn-sm"
            title="View on BscScan"
            onClick={handleLinkClick}
          >
            <HiOutlineArrowTopRightOnSquare /> BscScan
          </a>
          <Link
            to={`/projects/${project._id}/interact`}
            className="btn btn-secondary btn-sm"
            onClick={handleLinkClick}
          >
            Interact
          </Link>
        </div>
      </div>
    </div>
  );
}
