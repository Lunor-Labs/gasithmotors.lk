import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Database } from '../lib/database.types';
import { Plus, Search, Edit, UserCheck } from 'lucide-react';

type ReferralAgent = Database['public']['Tables']['referral_agents']['Row'];

export function ReferralAgents() {
  const [agents, setAgents] = useState<ReferralAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
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

  useEffect(() => {
    loadAgents();
  }, []);

  async function loadAgents() {
    try {
      const { data, error } = await supabase
        .from('referral_agents')
        .select('*')
        .eq('active', true)
        .order('name');

      if (error) throw error;
      setAgents(data || []);
    } catch (error) {
      console.error('Error loading referral agents:', error);
    } finally {
      setLoading(false);
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
        });

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
          })
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

  const filteredAgents = agents.filter((agent) =>
    agent.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
              <button
                onClick={() => openEditModal(agent)}
                className="p-1 hover:bg-slate-100 rounded transition"
              >
                <Edit className="w-4 h-4 text-slate-600" />
              </button>
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
    </div>
  );
}
