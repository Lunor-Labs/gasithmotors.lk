import { useEffect, useState } from 'react';
import { Package, Users, ShoppingCart, TrendingUp, DollarSign, AlertTriangle, FileText } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { StockFilter } from '../hooks/useProducts';
import { productService, customerService, salesService } from '../services';

interface DashboardStats {
  totalProducts: number;
  totalCustomers: number;
  todaySales: number;
  todayRevenue: number;
  lowStockProducts: number;
  outOfStockProducts: number;
  pendingReturns: number;
}

interface DashboardProps {
  onFilterNavigate?: (filter: StockFilter) => void;
}

export function Dashboard({ onFilterNavigate }: DashboardProps) {
  const [stats, setStats] = useState<DashboardStats>({
    totalProducts: 0,
    totalCustomers: 0,
    todaySales: 0,
    todayRevenue: 0,
    lowStockProducts: 0,
    outOfStockProducts: 0,
    pendingReturns: 0,
  });
  const [loading, setLoading] = useState(true);
  const [salesData, setSalesData] = useState<any[]>([]);
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [lowStockItems, setLowStockItems] = useState<any[]>([]);
  const [outOfStockItems, setOutOfStockItems] = useState<any[]>([]);
  const [activeStockTab, setActiveStockTab] = useState<'low' | 'out'>('low');
  const [topSellingItems, setTopSellingItems] = useState<any[]>([]);

  useEffect(() => {
    loadDashboardStats();
  }, []);

  async function loadDashboardStats() {
    try {
      const [
        allProducts,
        customerCount,
        todaySales,
        pendingReturnsCount,
        recentSalesData,
        salesHistory,
        topSellingData
      ] = await Promise.all([
        productService.getAllProducts(),
        customerService.getCustomerCount(),
        salesService.getTodaySales(),
        salesService.getPendingReturnsCount(),
        salesService.getRecentSales(5),
        salesService.getSalesHistory(50),
        salesService.getTopSellingItems(5)
      ]);

      const lowStockList = allProducts.filter(product => {
        return product.total_stock > 0 && product.total_stock <= (product.reorder_level || 0);
      });

      const outOfStockList = allProducts.filter(product => {
        return product.total_stock === 0;
      });

      // Process chart data
      const chartData = (salesHistory as any[] || []).map(sale => ({
        name: new Date(sale.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        value: Number(sale.total_amount)
      }));

      // Top selling items are already processed by the service
      const colors = ['#EF4444', '#F59E0B', '#3B82F6', '#8B5CF6', '#10B981'];
      const topSellingWithColors = (topSellingData as any[]).map((item, index) => ({
        ...item,
        color: colors[index % colors.length]
      }));

      setSalesData(chartData);
      setRecentSales(recentSalesData || []);
      setLowStockItems(lowStockList);
      setOutOfStockItems(outOfStockList);
      setTopSellingItems(topSellingWithColors);

      setStats({
        totalProducts: allProducts.length,
        totalCustomers: customerCount || 0,
        todaySales: todaySales.count,
        todayRevenue: todaySales.revenue,
        lowStockProducts: lowStockList.length,
        outOfStockProducts: outOfStockList.length,
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
      value: stats.totalProducts.toLocaleString(),
      subtext: 'Total Items',
      icon: Package,
      iconColor: 'text-blue-500',
      bgColor: 'bg-blue-50',
    },
    {
      title: 'Total Customers',
      value: stats.totalCustomers.toLocaleString(),
      subtext: 'Active Profiles',
      icon: Users,
      iconColor: 'text-emerald-500',
      bgColor: 'bg-emerald-50',
    },
    {
      title: "Today's Sales",
      value: stats.todaySales.toLocaleString(),
      subtext: 'Invoices Created',
      icon: ShoppingCart,
      iconColor: 'text-violet-500',
      bgColor: 'bg-violet-50',
    },
    {
      title: "Today's Revenue",
      value: `LKR ${stats.todayRevenue.toLocaleString()}`,
      subtext: 'Gross Income',
      icon: DollarSign,
      iconColor: 'text-green-500',
      bgColor: 'bg-green-50',
    },
    {
      title: 'Low Stock',
      value: stats.lowStockProducts.toLocaleString(),
      subtext: 'Items to Reorder',
      icon: AlertTriangle,
      iconColor: 'text-orange-500',
      bgColor: 'bg-orange-50',
      filter: 'low_stock' as StockFilter,
    },
    {
      title: 'Stock Out',
      value: stats.outOfStockProducts.toLocaleString(),
      subtext: 'Needs Immediate Restock',
      icon: AlertTriangle,
      iconColor: 'text-red-500',
      bgColor: 'bg-red-50',
      filter: 'out_of_stock' as StockFilter,
    },
    {
      title: 'Returns',
      value: stats.pendingReturns.toLocaleString(),
      subtext: 'Pending Process',
      icon: TrendingUp,
      iconColor: 'text-red-500',
      bgColor: 'bg-red-50',
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
    <div className="space-y-6">
      <div className="flex items-center justify-center lg:justify-between">
        <h2 className="text-2xl font-bold text-slate-900">Dashboard Overview</h2>
      </div>

      {/* Stats Grid - 6 Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 lg:gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.title}
              onClick={() => card.filter && onFilterNavigate?.(card.filter)}
              className={`bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col items-center text-center lg:items-start lg:text-left hover:shadow-md transition-shadow ${card.filter ? 'cursor-pointer' : ''}`}
            >
              <div className={`${card.bgColor} p-3 rounded-xl mb-3 lg:mb-4`}>
                <Icon className={`w-6 h-6 ${card.iconColor}`} />
              </div>
              <h3 className="text-xl lg:text-2xl font-bold text-slate-900 mb-1">{card.value}</h3>
              <p className="text-sm font-medium text-slate-700">{card.title}</p>
              <p className="text-xs text-slate-400 mt-1">{card.subtext}</p>
            </div>
          );
        })}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-900">Revenue vs Expense</h3>
            <select className="px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600 outline-none">
              <option>This Year</option>
              <option>This Month</option>
            </select>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesData.length > 0 ? salesData : [{ name: 'No Data', value: 0 }]}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ border: 'none', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Area type="monotone" dataKey="value" stroke="#10B981" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Selling Items Chart */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-900">Top Selling Items</h3>
            <button className="text-slate-400 hover:text-slate-600">
              <TrendingUp className="w-5 h-5" />
            </button>
          </div>
          <div className="h-[200px] relative flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={topSellingItems}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {topSellingItems.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            {topSellingItems.length > 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-bold text-slate-900">{topSellingItems[0].value}</span>
                <span className="text-xs text-slate-500">Units Sold</span>
              </div>
            )}
          </div>
          <div className="space-y-3 mt-6">
            {topSellingItems.map((item) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                  <span className="text-sm text-slate-600 truncate max-w-[150px]">{item.name}</span>
                </div>
                <span className="text-sm font-bold text-slate-900">{item.value}</span>
              </div>
            ))}
            {topSellingItems.length === 0 && (
              <p className="text-center text-slate-500 py-4 text-sm">No sales data for this month</p>
            )}
          </div>
        </div>
      </div>

      {/* Lists Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Invoices */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-900">Recent Invoice</h3>
            <select className="px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600 outline-none">
              <option>Sales Invoice</option>
            </select>
          </div>
          <div className="space-y-4">
            {recentSales.map((sale) => (
              <div key={sale.id} className="flex items-center justify-between py-2 hover:bg-slate-50 rounded-lg px-2 -mx-2 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">#{sale.sale_number.slice(-8)}</p>
                    <p className="text-xs text-slate-500">{sale.customers?.name || 'Walk-in'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-sm text-slate-500">{new Date(sale.created_at).toLocaleDateString()}</p>
                    <p className="text-sm font-bold text-slate-900">LKR {Number(sale.total_amount).toLocaleString()}</p>
                  </div>
                  <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                    Success
                  </span>
                </div>
              </div>
            ))}
            {recentSales.length === 0 && (
              <p className="text-center text-slate-500 py-4">No recent sales found</p>
            )}
          </div>
        </div>

        {/* Stock Alert */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-900 cursor-pointer hover:text-blue-600 transition-colors"
              onClick={() => onFilterNavigate?.(activeStockTab === 'low' ? 'low_stock' : 'out_of_stock')}>
              Stock Alert
            </h3>
            <div className="flex bg-slate-100 p-1 rounded-lg">
              <button
                onClick={() => setActiveStockTab('low')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${activeStockTab === 'low' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Low Stock ({stats.lowStockProducts})
              </button>
              <button
                onClick={() => setActiveStockTab('out')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${activeStockTab === 'out' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Stock Out ({stats.outOfStockProducts})
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider pb-2 border-b border-slate-100">
              <span>Product</span>
              <span>Quantity</span>
            </div>
            {activeStockTab === 'low' ? (
              <>
                {lowStockItems.slice(0, 10).map((item, index) => (
                  <div key={index}
                    onClick={() => onFilterNavigate?.('low_stock')}
                    className="flex items-center justify-between py-2 cursor-pointer hover:bg-slate-50 px-2 -mx-2 rounded-lg transition-colors">
                    <span className="text-sm font-medium text-slate-700">{item.name}</span>
                    <span className="text-sm font-bold text-orange-600">{item.total_stock}</span>
                  </div>
                ))}
                {lowStockItems.length === 0 && (
                  <p className="text-center text-slate-500 py-4">No low stock items</p>
                )}
              </>
            ) : (
              <>
                {outOfStockItems.slice(0, 10).map((item, index) => (
                  <div key={index}
                    onClick={() => onFilterNavigate?.('out_of_stock')}
                    className="flex items-center justify-between py-2 cursor-pointer hover:bg-slate-50 px-2 -mx-2 rounded-lg transition-colors">
                    <span className="text-sm font-medium text-slate-700">{item.name}</span>
                    <span className="text-sm font-bold text-red-600">{item.total_stock}</span>
                  </div>
                ))}
                {outOfStockItems.length === 0 && (
                  <p className="text-center text-slate-500 py-4">No out of stock items</p>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* <div className="mt-8 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-bold text-slate-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <button className="p-4 border-2 border-slate-200 rounded-lg hover:border-slate-900 hover:bg-slate-50 transition flex flex-col items-center text-center lg:items-start lg:text-left">
            <ShoppingCart className="w-8 h-8 text-slate-900 mb-2" />
            <p className="font-medium text-slate-900">New Sale</p>
            <p className="text-sm text-slate-600">Process a new transaction</p>
          </button>
          <button className="p-4 border-2 border-slate-200 rounded-lg hover:border-slate-900 hover:bg-slate-50 transition flex flex-col items-center text-center lg:items-start lg:text-left">
            <Package className="w-8 h-8 text-slate-900 mb-2" />
            <p className="font-medium text-slate-900">Add Product</p>
            <p className="text-sm text-slate-600">Create new product</p>
          </button>
          <button className="p-4 border-2 border-slate-200 rounded-lg hover:border-slate-900 hover:bg-slate-50 transition flex flex-col items-center text-center lg:items-start lg:text-left">
            <Users className="w-8 h-8 text-slate-900 mb-2" />
            <p className="font-medium text-slate-900">New Customer</p>
            <p className="text-sm text-slate-600">Add customer record</p>
          </button>
          <button className="p-4 border-2 border-slate-200 rounded-lg hover:border-slate-900 hover:bg-slate-50 transition flex flex-col items-center text-center lg:items-start lg:text-left">
            <TrendingUp className="w-8 h-8 text-slate-900 mb-2" />
            <p className="font-medium text-slate-900">View Reports</p>
            <p className="text-sm text-slate-600">Analytics & insights</p>
          </button>
        </div>
      </div> */}
    </div>
  );
}
