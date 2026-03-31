import type { ReactNode } from 'react';
import './PageWrapper.css';

interface PageWrapperProps {
  children: ReactNode;
  title?: ReactNode;
  subtitle?: ReactNode;
  noSidebar?: boolean;
}

export default function PageWrapper({ children, title, subtitle, noSidebar }: PageWrapperProps) {
  return (
    <main className={`page-wrapper ${noSidebar ? 'no-sidebar' : ''}`}>
      {title && (
        <div className="page-header">
          <h1 className="page-title">{title}</h1>
          {subtitle && <p className="page-subtitle">{subtitle}</p>}
        </div>
      )}
      {children}
    </main>
  );
}
