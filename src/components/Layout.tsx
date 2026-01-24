import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  Package,
  ShoppingCart,
  Users,
  Truck,
  FileText,
  RotateCcw,
  TrendingUp,
  Settings,
  LogOut,
  Menu,
  X,
  BarChart3,
  UserCheck,
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  currentView: string;
  onNavigate: (view: string) => void;
}

export function Layout({ children, currentView, onNavigate }: LayoutProps) {
  const { profile, signOut, isAdmin } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navigation = [
    { name: 'Dashboard', icon: BarChart3, view: 'dashboard', roles: ['admin', 'cashier'] },
    { name: 'POS', icon: ShoppingCart, view: 'pos', roles: ['admin', 'cashier'] },
    { name: 'Products', icon: Package, view: 'products', roles: ['admin', 'cashier'] },
    { name: 'Purchase Orders', icon: FileText, view: 'purchase-orders', roles: ['admin', 'cashier'] },
    { name: 'Customers', icon: Users, view: 'customers', roles: ['admin', 'cashier'] },
    { name: 'Suppliers', icon: Truck, view: 'suppliers', roles: ['admin', 'cashier'] },
    { name: 'Referral Agents', icon: UserCheck, view: 'referral-agents', roles: ['admin'] },
    { name: 'Returns', icon: RotateCcw, view: 'returns', roles: ['admin', 'cashier'] },
    { name: 'Reports', icon: TrendingUp, view: 'reports', roles: ['admin'] },
    { name: 'Settings', icon: Settings, view: 'settings', roles: ['admin'] },
  ];

  const filteredNavigation = navigation.filter((item) =>
    item.roles.includes(profile?.role || '')
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="fixed top-0 left-0 right-0 bg-white border-b border-slate-200 z-50">
        <div className="flex items-center justify-between px-4 h-16">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 hover:bg-slate-100 rounded-lg transition"
            >
              {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
            <div className="flex items-center gap-2">
              <Package className="w-8 h-8 text-slate-900" />
              <div>
                <h1 className="text-xl font-bold text-slate-900">Vehicle Parts POS</h1>
                <p className="text-xs text-slate-500">{profile?.role === 'admin' ? 'Admin' : 'Cashier'}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-slate-900">{profile?.full_name}</p>
              <p className="text-xs text-slate-500">{profile?.email}</p>
            </div>
            <button
              onClick={signOut}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </div>

      <div
        className={`fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden transition-opacity ${
          sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setSidebarOpen(false)}
      />

      <aside
        className={`fixed top-16 left-0 bottom-0 w-64 bg-white border-r border-slate-200 z-40 transition-transform lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <nav className="p-4 space-y-1">
          {filteredNavigation.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.view;

            return (
              <button
                key={item.view}
                onClick={() => {
                  onNavigate(item.view);
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                  isActive
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.name}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      <main className="lg:pl-64 pt-16">
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
