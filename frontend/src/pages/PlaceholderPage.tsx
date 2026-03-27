import PageWrapper from '../components/Layout/PageWrapper';

export default function PlaceholderPage({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <PageWrapper title={title} subtitle={subtitle}>
      <div className="card" style={{ textAlign: 'center', padding: 'var(--space-16)' }}>
        <div style={{ fontSize: '3rem', marginBottom: 'var(--space-4)' }}>🚧</div>
        <h2 style={{ color: 'var(--color-text-secondary)', fontWeight: 'var(--font-weight-medium)' }}>
          Coming Soon
        </h2>
        <p style={{ color: 'var(--color-text-muted)', marginTop: 'var(--space-2)' }}>
          This feature will be available in a future phase.
        </p>
      </div>
    </PageWrapper>
  );
}
