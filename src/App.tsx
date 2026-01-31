import { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Login } from './components/Login';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { Products } from './components/Products';
import { Suppliers } from './components/Suppliers';
import { Customers } from './components/Customers';
import { ReferralAgents } from './components/ReferralAgents';
import { POS } from './components/POS';
import { Returns } from './components/Returns';
import { SalesHistory } from './components/SalesHistory';
import { Reports } from './components/Reports';
import { Settings } from './components/Settings';

function AppContent() {
  const { user, profile, loading } = useAuth();
  const [currentView, setCurrentView] = useState('dashboard');

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !profile) {
    return <Login />;
  }

  return (
    <Layout currentView={currentView} onNavigate={setCurrentView}>
      {currentView === 'dashboard' && <Dashboard />}
      {currentView === 'pos' && <POS />}
      {currentView === 'products' && <Products />}
      {currentView === 'customers' && <Customers />}
      {currentView === 'suppliers' && <Suppliers />}
      {currentView === 'referral-agents' && <ReferralAgents />}
      {currentView === 'returns' && <Returns />}
      {currentView === 'sales-history' && <SalesHistory />}
      {currentView === 'reports' && <Reports />}
      {currentView === 'settings' && <Settings />}
    </Layout>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
