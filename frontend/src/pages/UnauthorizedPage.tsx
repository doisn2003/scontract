import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { HiOutlineShieldCheck } from 'react-icons/hi2';
import PageWrapper from '../components/Layout/PageWrapper';
import './UnauthorizedPage.css';

export default function UnauthorizedPage() {
  const { t } = useTranslation();

  return (
    <PageWrapper title={t('pages.interact.unauthorized.title')}>
      <div className="unauthorized-container animate-fade-in">
        <div className="unauthorized-card">
          <div className="unauthorized-icon">
            <HiOutlineShieldCheck size={48} />
          </div>
          <h1 className="unauthorized-title">{t('pages.interact.unauthorized.title')}</h1>
          <p className="unauthorized-msg">{t('pages.interact.unauthorized.msg')}</p>
          
          <div className="unauthorized-divider"></div>
          
          <div className="unauthorized-contact">
            <span>{t('pages.interact.unauthorized.contact_prefix')}</span>
            <a href="mailto:admin@sphoton.com" className="unauthorized-email">admin@sphoton.com</a>
          </div>
          
          <Link to="/dashboard" className="btn btn-primary unauthorized-btn">
            {t('pages.interact.unauthorized.back_to_dashboard')}
          </Link>
        </div>
      </div>
    </PageWrapper>
  );
}
