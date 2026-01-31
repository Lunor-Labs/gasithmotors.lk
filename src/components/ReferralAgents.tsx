import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Database } from '../lib/database.types';
import { Plus, Search, Edit, UserCheck, DollarSign, Calendar, CheckCircle, Clock } from 'lucide-react';

type ReferralAgent = Database['public']['Tables']['referral_agents']['Row'];

interface Commission {
  id: string;
  sale_id: string;
  sale_amount: number;
  commission_amount: number;
  status: 'pending' | 'paid';
  created_at: string;
  payment_date: string | null;
  sale?: {
    sale_number: string;
  };
}

export function ReferralAgents() {
  const [agents, setAgents] = useState<ReferralAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Agent Modal State
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [selectedAgent, setSelectedAgent] = useState<ReferralAgent | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'individual' as 'garage' | 'individual',
    phone: '',
    email: '',
    address: '',
    commission_rate: 5,
  });

  // Commission Modal State
  const [showCommissionModal, setShowCommissionModal] = useState(false);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [loadingCommissions, setLoadingCommissions] = useState(false);
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setDate(1)).toISOString().split('T')[0], // Start of current month
    end: new Date().toISOString().split('T')[0], // Today
  });

  useEffect(() => {
    loadAgents();
  }, []);

  useEffect(() => {
    if (showCommissionModal && selectedAgent) {
      loadCommissions(selectedAgent.id);
    }
  }, [showCommissionModal, selectedAgent]);

  async function loadAgents() {
    try {
      const { data, error } = await supabase
        .from('referral_agents')
        .select('*')
        .eq('active', true)
        .order('name');

      if (error) throw error;
      setAgents((data as any) || []);
    } catch (error) {
      console.error('Error loading referral agents:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadCommissions(agentId: string) {
    setLoadingCommissions(true);
    try {
      // Load all commissions for this agent to calculate totals
      // In a real app with pagination, we might want to do aggregation queries separately
      const { data, error } = await supabase
        .from('referral_commissions')
        .select(`
          *,
          sale:sales(sale_number)
        `)
        .eq('referral_agent_id', agentId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Transform and set data
      const formattedData = ((data as any) || []).map((item: any) => ({
        ...item,
        sale: item.sale ? (Array.isArray(item.sale) ? item.sale[0] : item.sale) : null
      })) as Commission[];

      setCommissions(formattedData);
    } catch (error) {
      console.error('Error loading commissions:', error);
      alert('Failed to load commissions');
    } finally {
      setLoadingCommissions(false);
    }
  }

  async function handlePayload(filteredCommissions: Commission[]) {
    if (!filteredCommissions.length) {
      alert('No commissions selected for payout');
      return;
    }

    const totalAmount = filteredCommissions.reduce((sum, c) => sum + c.commission_amount, 0);

    if (!confirm(`Are you sure you want to payout LKR ${totalAmount.toFixed(2)} for ${filteredCommissions.length} transactions?`)) {
      return;
    }

    try {
      const idsToUpdate = filteredCommissions.map(c => c.id);

      const { error } = await supabase
        .from('referral_commissions')
        .update({
          status: 'paid',
          payment_date: new Date().toISOString(),
          updated_at: new Date().toISOString()
        } as any)
        .in('id', idsToUpdate);

      if (error) throw error;

      alert('Payout recorded successfully!');
      if (selectedAgent) {
        loadCommissions(selectedAgent.id);
      }
    } catch (error: any) {
      alert('Error recording payout: ' + error.message);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      if (modalMode === 'add') {
        const { error } = await supabase.from('referral_agents').insert({
          name: formData.name,
          type: formData.type,
          phone: formData.phone || null,
          email: formData.email || null,
          address: formData.address || null,
          commission_rate: formData.commission_rate,
        } as any);

        if (error) throw error;
      } else if (selectedAgent) {
        const { error } = await supabase
          .from('referral_agents')
          .update({
            name: formData.name,
            type: formData.type,
            phone: formData.phone || null,
            email: formData.email || null,
            address: formData.address || null,
            commission_rate: formData.commission_rate,
            updated_at: new Date().toISOString(),
          } as any)
          .eq('id', selectedAgent.id);

        if (error) throw error;
      }

      setShowModal(false);
      resetForm();
      loadAgents();
    } catch (error: any) {
      alert(error.message);
    }
  }

  function resetForm() {
    setFormData({
      name: '',
      type: 'individual',
      phone: '',
      email: '',
      address: '',
      commission_rate: 5,
    });
    setSelectedAgent(null);
  }

  function openAddModal() {
    resetForm();
    setModalMode('add');
    setShowModal(true);
  }

  function openEditModal(agent: ReferralAgent) {
    setSelectedAgent(agent);
    setFormData({
      name: agent.name,
      type: (agent.type || 'individual') as 'garage' | 'individual',
      phone: agent.phone || '',
      email: agent.email || '',
      address: agent.address || '',
      commission_rate: agent.commission_rate,
    });
    setModalMode('edit');
    setShowModal(true);
  }

  function openCommissionModal(agent: ReferralAgent) {
    setSelectedAgent(agent);
    setShowCommissionModal(true);
    setActiveTab('pending');
  }

  const filteredAgents = agents.filter((agent) =>
    agent.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Commission Calculations
  const pendingCommissions = commissions.filter(c => c.status === 'pending');
  const paidCommissions = commissions.filter(c => c.status === 'paid');

  const totalEarned = commissions.reduce((sum, c) => sum + c.commission_amount, 0);
  const totalPaid = paidCommissions.reduce((sum, c) => sum + c.commission_amount, 0);
  const totalPending = pendingCommissions.reduce((sum, c) => sum + c.commission_amount, 0);

  // Filter pending by date range
  const filteredPendingCommissions = pendingCommissions.filter(c => {
    const commissionDate = new Date(c.created_at).toISOString().split('T')[0];
    return commissionDate >= dateRange.start && commissionDate <= dateRange.end;
  });

  const filteredPendingTotal = filteredPendingCommissions.reduce((sum, c) => sum + c.commission_amount, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Referral Agents</h2>
          <p className="text-slate-600 mt-1">Manage garages and individuals who refer customers</p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition"
        >
          <Plus className="w-5 h-5" />
          Add Agent
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
        <div className="flex items-center gap-2">
          <Search className="w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search referral agents..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 outline-none text-slate-900"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredAgents.map((agent) => (
          <div
            key={agent.id}
            className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="bg-slate-100 p-2 rounded-lg">
                  <UserCheck className="w-6 h-6 text-slate-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">{agent.name}</h3>
                  <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 mt-1">
                    {agent.type === 'garage' ? 'Garage' : 'Individual'}
                  </span>
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => openCommissionModal(agent)}
                  className="p-1 hover:bg-green-50 rounded transition text-green-600"
                  title="Manage Commissions"
                >
                  <DollarSign className="w-4 h-4" />
                </button>
                <button
                  onClick={() => openEditModal(agent)}
                  className="p-1 hover:bg-slate-100 rounded transition"
                  title="Edit Agent"
                >
                  <Edit className="w-4 h-4 text-slate-600" />
                </button>
              </div>
            </div>

            <div className="space-y-2 text-sm mb-4">
              {agent.phone && (
                <div className="flex items-center gap-2 text-slate-600">
                  <span className="font-medium">Phone:</span>
                  <span>{agent.phone}</span>
                </div>
              )}
              {agent.email && (
                <div className="flex items-center gap-2 text-slate-600">
                  <span className="font-medium">Email:</span>
                  <span>{agent.email}</span>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Commission Rate</span>
                <span className="text-lg font-bold text-slate-900">{agent.commission_rate}%</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Edit/Add Agent Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-xl font-bold text-slate-900">
                {modalMode === 'add' ? 'Add Referral Agent' : 'Edit Referral Agent'}
              </h3>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as 'garage' | 'individual' })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                  >
                    <option value="individual">Individual</option>
                    <option value="garage">Garage</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Commission Rate (%) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.commission_rate}
                    onChange={(e) => setFormData({ ...formData, commission_rate: parseFloat(e.target.value) })}
                    required
                    min="0"
                    max="100"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Address
                  </label>
                  <textarea
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition"
                >
                  {modalMode === 'add' ? 'Add Agent' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Commission Details Modal */}
      {showCommissionModal && selectedAgent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-slate-200 flex justify-between items-start">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Commission Management</h3>
                <p className="text-slate-600">{selectedAgent.name}</p>
              </div>
              <button
                onClick={() => setShowCommissionModal(false)}
                className="p-2 hover:bg-slate-100 rounded-full transition"
              >
                <span className="text-2xl">&times;</span>
              </button>
            </div>

            <div className="p-6 bg-slate-50 border-b border-slate-200">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-lg shadow-sm">
                  <p className="text-xs font-semibold text-slate-500 uppercase">Total Earned</p>
                  <p className="text-xl font-bold text-slate-900 mt-1">LKR {totalEarned.toFixed(2)}</p>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-sm">
                  <p className="text-xs font-semibold text-slate-500 uppercase">Total Paid</p>
                  <p className="text-xl font-bold text-green-600 mt-1">LKR {totalPaid.toFixed(2)}</p>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-sm">
                  <p className="text-xs font-semibold text-slate-500 uppercase">Pending Balance</p>
                  <p className="text-xl font-bold text-orange-600 mt-1">LKR {totalPending.toFixed(2)}</p>
                </div>
              </div>
            </div>

            <div className="flex border-b border-slate-200">
              <button
                className={`px-6 py-3 text-sm font-medium border-b-2 transition ${activeTab === 'pending'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                onClick={() => setActiveTab('pending')}
              >
                Pending Commissions
              </button>
              <button
                className={`px-6 py-3 text-sm font-medium border-b-2 transition ${activeTab === 'history'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                onClick={() => setActiveTab('history')}
              >
                Payout History
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {loadingCommissions ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
                </div>
              ) : activeTab === 'pending' ? (
                <div className="space-y-6">
                  <div className="flex items-end gap-4 p-4 bg-slate-50 rounded-lg">
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-slate-700">From</label>
                      <input
                        type="date"
                        value={dateRange.start}
                        onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                        className="block w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-slate-700">To</label>
                      <input
                        type="date"
                        value={dateRange.end}
                        onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                        className="block w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                      />
                    </div>
                    <div className="flex-1 text-right">
                      <p className="text-sm text-slate-500">Payable Amount (Filtered)</p>
                      <p className="text-lg font-bold text-slate-900">LKR {filteredPendingTotal.toFixed(2)}</p>
                    </div>
                    <button
                      onClick={() => handlePayload(filteredPendingCommissions)}
                      disabled={filteredPendingTotal === 0}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Record Payout
                    </button>
                  </div>

                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Sale ID</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Sale Amount</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Commission</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {filteredPendingCommissions.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-4 py-8 text-center text-slate-500">No pending commissions in this period</td>
                          </tr>
                        ) : (
                          filteredPendingCommissions.map(c => (
                            <tr key={c.id}>
                              <td className="px-4 py-2 text-sm text-slate-900">
                                {new Date(c.created_at).toLocaleDateString()}
                              </td>
                              <td className="px-4 py-2 text-sm text-slate-600">
                                #{c.sale?.sale_number}
                              </td>
                              <td className="px-4 py-2 text-sm text-slate-600 text-right">
                                LKR {c.sale_amount.toFixed(2)}
                              </td>
                              <td className="px-4 py-2 text-sm font-medium text-orange-600 text-right">
                                LKR {c.commission_amount.toFixed(2)}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                // Payout History Tab
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Paid Date</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Sale ID</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Amount Paid</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {paidCommissions.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-4 py-8 text-center text-slate-500">No payment history found</td>
                        </tr>
                      ) : (
                        paidCommissions.map(c => (
                          <tr key={c.id}>
                            <td className="px-4 py-2 text-sm text-slate-900">
                              {c.payment_date ? new Date(c.payment_date).toLocaleDateString() : '-'}
                            </td>
                            <td className="px-4 py-2 text-sm text-slate-600">
                              #{c.sale?.sale_number}
                            </td>
                            <td className="px-4 py-2 text-sm font-medium text-green-600 text-right">
                              LKR {c.commission_amount.toFixed(2)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setShowCommissionModal(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
