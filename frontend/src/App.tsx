import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

// Layout
import Navbar from './components/Layout/Navbar';
import Sidebar from './components/Layout/Sidebar';

// Pages
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import PlaceholderPage from './pages/PlaceholderPage';

/**
 * Layout wrapper that includes Navbar + Sidebar for authenticated pages
 */
function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar userName="User" />
      <Sidebar />
      {children}
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
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
            iconTheme: {
              primary: '#22c55e',
              secondary: '#f1f5f9',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#f1f5f9',
            },
          },
        }}
      />

      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Protected routes (auth guard will be added in Phase 1) */}
        <Route
          path="/dashboard"
          element={
            <AppLayout>
              <DashboardPage />
            </AppLayout>
          }
        />
        <Route
          path="/wallets"
          element={
            <AppLayout>
              <PlaceholderPage title="Wallets" subtitle="Manage your Web3 wallets" />
            </AppLayout>
          }
        />
        <Route
          path="/projects/create"
          element={
            <AppLayout>
              <PlaceholderPage title="New Project" subtitle="Upload & deploy a smart contract" />
            </AppLayout>
          }
        />
        <Route
          path="/projects"
          element={
            <AppLayout>
              <PlaceholderPage title="My Projects" subtitle="View all your smart contract projects" />
            </AppLayout>
          }
        />
        <Route
          path="/projects/:id"
          element={
            <AppLayout>
              <PlaceholderPage title="Project Detail" subtitle="View project details" />
            </AppLayout>
          }
        />
        <Route
          path="/projects/:id/interact"
          element={
            <AppLayout>
              <PlaceholderPage title="Interact" subtitle="Interact with your smart contract" />
            </AppLayout>
          }
        />
        <Route
          path="/projects/:id/test"
          element={
            <AppLayout>
              <PlaceholderPage title="Unit Tests" subtitle="Run tests on your smart contract" />
            </AppLayout>
          }
        />
        <Route
          path="/explore"
          element={
            <AppLayout>
              <PlaceholderPage title="Explore" subtitle="Browse deployed smart contracts" />
            </AppLayout>
          }
        />
        <Route
          path="/transactions"
          element={
            <AppLayout>
              <PlaceholderPage title="Transaction History" subtitle="View all your transactions" />
            </AppLayout>
          }
        />

        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
