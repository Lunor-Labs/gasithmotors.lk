import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Package, Users, ShoppingCart, TrendingUp, DollarSign, AlertTriangle } from 'lucide-react';

interface DashboardStats {
  totalProducts: number;
  totalCustomers: number;
  todaySales: number;
  todayRevenue: number;
  lowStockProducts: number;
  pendingReturns: number;
}

export function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalProducts: 0,
    totalCustomers: 0,
    todaySales: 0,
    todayRevenue: 0,
    lowStockProducts: 0,
    pendingReturns: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardStats();
  }, []);

  async function loadDashboardStats() {
    try {
      const today = new Date().toISOString().split('T')[0];

      const [
        { count: productCount },
        { count: customerCount },
        { data: todaySalesData },
        { data: lowStockData },
        { count: pendingReturnsCount },
      ] = await Promise.all([
        supabase.from('products').select('*', { count: 'exact', head: true }).eq('active', true),
        supabase.from('customers').select('*', { count: 'exact', head: true }).eq('active', true),
        supabase.from('sales').select('total_amount').gte('sale_date', today),
        supabase
          .from('product_batches')
          .select('current_quantity, products!inner(reorder_level)')
          .eq('products.active', true),
        supabase.from('returns').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      ]);

      const todayRevenue = todaySalesData?.reduce((sum, sale) => sum + Number(sale.total_amount), 0) || 0;
      const lowStock = lowStockData?.filter((batch: any) => {
        return batch.current_quantity <= (batch.products?.reorder_level || 0);
      }).length || 0;

      setStats({
        totalProducts: productCount || 0,
        totalCustomers: customerCount || 0,
        todaySales: todaySalesData?.length || 0,
        todayRevenue,
        lowStockProducts: lowStock,
        pendingReturns: pendingReturnsCount || 0,
      });
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  }

  const statCards = [
    {
      title: 'Total Products',
      value: stats.totalProducts,
      icon: Package,
      color: 'bg-blue-500',
    },
    {
      title: 'Total Customers',
      value: stats.totalCustomers,
      icon: Users,
      color: 'bg-green-500',
    },
    {
      title: "Today's Sales",
      value: stats.todaySales,
      icon: ShoppingCart,
      color: 'bg-orange-500',
    },
    {
      title: "Today's Revenue",
      value: `LKR ${stats.todayRevenue.toFixed(2)}`,
      icon: DollarSign,
      color: 'bg-emerald-500',
    },
    {
      title: 'Low Stock Items',
      value: stats.lowStockProducts,
      icon: AlertTriangle,
      color: 'bg-red-500',
    },
    {
      title: 'Pending Returns',
      value: stats.pendingReturns,
      icon: TrendingUp,
      color: 'bg-slate-500',
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900">Dashboard</h2>
        <p className="text-slate-600 mt-1">Overview of your inventory and sales</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.title}
              className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 font-medium">{card.title}</p>
                  <p className="text-3xl font-bold text-slate-900 mt-2">{card.value}</p>
                </div>
                <div className={`${card.color} p-3 rounded-xl`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-8 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-bold text-slate-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <button className="p-4 border-2 border-slate-200 rounded-lg hover:border-slate-900 hover:bg-slate-50 transition text-left">
            <ShoppingCart className="w-8 h-8 text-slate-900 mb-2" />
            <p className="font-medium text-slate-900">New Sale</p>
            <p className="text-sm text-slate-600">Process a new transaction</p>
          </button>
          <button className="p-4 border-2 border-slate-200 rounded-lg hover:border-slate-900 hover:bg-slate-50 transition text-left">
            <Package className="w-8 h-8 text-slate-900 mb-2" />
            <p className="font-medium text-slate-900">Add Product</p>
            <p className="text-sm text-slate-600">Create new product</p>
          </button>
          <button className="p-4 border-2 border-slate-200 rounded-lg hover:border-slate-900 hover:bg-slate-50 transition text-left">
            <Users className="w-8 h-8 text-slate-900 mb-2" />
            <p className="font-medium text-slate-900">New Customer</p>
            <p className="text-sm text-slate-600">Add customer record</p>
          </button>
          <button className="p-4 border-2 border-slate-200 rounded-lg hover:border-slate-900 hover:bg-slate-50 transition text-left">
            <TrendingUp className="w-8 h-8 text-slate-900 mb-2" />
            <p className="font-medium text-slate-900">View Reports</p>
            <p className="text-sm text-slate-600">Analytics & insights</p>
          </button>
        </div>
      </div>
    </div>
  );
}
