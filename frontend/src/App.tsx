import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

// Context
import { AuthProvider } from './context/AuthContext';

// Layout
import Navbar from './components/Layout/Navbar';
import Sidebar from './components/Layout/Sidebar';
import ProtectedRoute from './components/ProtectedRoute';

// Auth hook (used inside AuthProvider)
import { useAuth } from './context/AuthContext';

// Pages
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import WalletsPage from './pages/WalletsPage';
import CreateProjectPage from './pages/CreateProjectPage';
import ProjectListPage from './pages/ProjectListPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import ExplorePage from './pages/ExplorePage';
import PlaceholderPage from './pages/PlaceholderPage';

/**
 * Layout wrapper that includes Navbar + Sidebar for authenticated pages
 */
function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  return (
    <>
      <Navbar userName={user?.name} />
      <Sidebar />
      {children}
    </>
  );
}

/**
 * Protected page with AppLayout
 */
function ProtectedPage({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <AppLayout>
        {children}
      </AppLayout>
    </ProtectedRoute>
  );
}

function AppRoutes() {
  const { isAuthenticated, isLoading } = useAuth();

  // Don't redirect until auth state is loaded
  if (isLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-bg-primary)',
      }}>
        <div className="spinner" style={{ width: 40, height: 40 }} />
      </div>
    );
  }

  return (
    <Routes>
      {/* Public routes — redirect to dashboard if already logged in */}
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />}
      />
      <Route
        path="/register"
        element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <RegisterPage />}
      />

      {/* Protected routes */}
      <Route path="/dashboard" element={<ProtectedPage><DashboardPage /></ProtectedPage>} />
      <Route path="/wallets" element={<ProtectedPage><WalletsPage /></ProtectedPage>} />
      <Route path="/projects/create" element={<ProtectedPage><CreateProjectPage /></ProtectedPage>} />
      <Route path="/projects" element={<ProtectedPage><ProjectListPage /></ProtectedPage>} />
      <Route path="/projects/:id" element={<ProtectedPage><ProjectDetailPage /></ProtectedPage>} />
      <Route path="/projects/:id/interact" element={<ProtectedPage><PlaceholderPage title="Interact" subtitle="Interact with your smart contract" /></ProtectedPage>} />
      <Route path="/projects/:id/test" element={<ProtectedPage><PlaceholderPage title="Unit Tests" subtitle="Run tests on your smart contract" /></ProtectedPage>} />
      <Route path="/explore" element={<ProtectedPage><ExplorePage /></ProtectedPage>} />
      <Route path="/transactions" element={<ProtectedPage><PlaceholderPage title="Transaction History" subtitle="View all your transactions" /></ProtectedPage>} />

      {/* Default redirect */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#1e293b',
              color: '#f1f5f9',
              border: '1px solid #334155',
              borderRadius: '12px',
              fontSize: '14px',
            },
            success: {
              iconTheme: { primary: '#22c55e', secondary: '#f1f5f9' },
            },
            error: {
              iconTheme: { primary: '#ef4444', secondary: '#f1f5f9' },
            },
          }}
        />
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
