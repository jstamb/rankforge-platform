import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Building2, Plus, Search, MoreVertical, Edit, Trash2,
  Loader2, MapPin, Phone, Mail, Globe, AlertTriangle, Sparkles
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Business } from '../types';

export const Businesses: React.FC = () => {
  const navigate = useNavigate();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState<Business | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadBusinesses();
  }, []);

  const loadBusinesses = async () => {
    if (!isSupabaseConfigured()) {
      // Mock data for demo
      setBusinesses([
        {
          id: '1',
          business_name: 'Seattle Plumbing Pro',
          business_type: 'plumber',
          phone: '(206) 555-0123',
          email: 'info@seattleplumbingpro.com',
          address_street: '123 Main St',
          address_city: 'Seattle',
          address_state: 'WA',
          address_zip: '98101',
          description: 'Professional plumbing services in Seattle and surrounding areas.',
          services: ['Drain Cleaning', 'Water Heater Repair', 'Pipe Installation', 'Emergency Plumbing'],
          target_keywords: ['seattle plumber', 'emergency plumber seattle', 'drain cleaning seattle'],
        },
        {
          id: '2',
          business_name: 'Bay Area Law Group',
          business_type: 'lawyer',
          phone: '(415) 555-0456',
          email: 'contact@bayarealaw.com',
          address_street: '456 Market St',
          address_city: 'San Francisco',
          address_state: 'CA',
          address_zip: '94102',
          description: 'Expert legal services for personal injury and business law.',
          services: ['Personal Injury', 'Business Law', 'Estate Planning'],
          target_keywords: ['san francisco lawyer', 'personal injury attorney sf'],
        },
      ]);
      setLoading(false);
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('businesses')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBusinesses(data || []);
    } catch (error) {
      console.error('Error loading businesses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      if (isSupabaseConfigured()) {
        const { error } = await supabase
          .from('businesses')
          .delete()
          .eq('id', id);
        if (error) throw error;
      }
      setBusinesses(businesses.filter(b => b.id !== id));
      setShowDeleteModal(null);
    } catch (error) {
      console.error('Error deleting business:', error);
    } finally {
      setDeleting(false);
    }
  };

  const handleSave = async (business: Business) => {
    setSaving(true);
    try {
      if (isSupabaseConfigured()) {
        const { error } = await supabase
          .from('businesses')
          .update({
            business_name: business.business_name,
            business_type: business.business_type,
            phone: business.phone,
            email: business.email,
            address_street: business.address_street,
            address_city: business.address_city,
            address_state: business.address_state,
            address_zip: business.address_zip,
            description: business.description,
          })
          .eq('id', business.id);
        if (error) throw error;
      }
      setBusinesses(businesses.map(b => b.id === business.id ? business : b));
      setShowEditModal(null);
    } catch (error) {
      console.error('Error saving business:', error);
    } finally {
      setSaving(false);
    }
  };

  const filteredBusinesses = businesses.filter(business =>
    business.business_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    business.business_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
    business.address_city?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const businessTypeLabels: Record<string, string> = {
    plumber: 'Plumbing',
    electrician: 'Electrical',
    lawyer: 'Legal Services',
    hvac: 'HVAC',
    roofing: 'Roofing',
    landscaping: 'Landscaping',
    dental: 'Dental',
    medical: 'Medical',
    other: 'Other',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Businesses</h1>
          <p className="text-slate-500 mt-1">Manage your business profiles for website generation</p>
        </div>
        <Link
          to="/websites/new"
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
        >
          <Plus size={18} />
          Add Business
        </Link>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input
          type="text"
          placeholder="Search businesses..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
        />
      </div>

      {/* Empty State */}
      {filteredBusinesses.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900">No businesses yet</h3>
          <p className="text-slate-500 mt-2 mb-6">Add your first business to start generating websites.</p>
          <Link
            to="/websites/new"
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
          >
            <Plus size={18} />
            Add Business
          </Link>
        </div>
      )}

      {/* Businesses Grid */}
      {filteredBusinesses.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredBusinesses.map((business) => (
            <div
              key={business.id}
              className="bg-white rounded-xl border border-slate-200 p-6 hover:border-slate-300 transition-colors"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-600">
                    <Building2 size={24} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">{business.business_name}</h3>
                    <span className="text-sm text-indigo-600 font-medium">
                      {businessTypeLabels[business.business_type] || business.business_type}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setShowEditModal(business)}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <Edit size={16} />
                  </button>
                  <button
                    onClick={() => setShowDeleteModal(business.id)}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {business.description && (
                <p className="text-sm text-slate-600 mb-4 line-clamp-2">{business.description}</p>
              )}

              <div className="space-y-2 text-sm">
                {(business.address_city || business.address_state) && (
                  <div className="flex items-center gap-2 text-slate-500">
                    <MapPin size={14} />
                    <span>{[business.address_city, business.address_state].filter(Boolean).join(', ')}</span>
                  </div>
                )}
                {business.phone && (
                  <div className="flex items-center gap-2 text-slate-500">
                    <Phone size={14} />
                    <span>{business.phone}</span>
                  </div>
                )}
                {business.email && (
                  <div className="flex items-center gap-2 text-slate-500">
                    <Mail size={14} />
                    <span>{business.email}</span>
                  </div>
                )}
              </div>

              {/* Services Tags */}
              {business.services && business.services.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-100">
                  {business.services.slice(0, 4).map((service, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs"
                    >
                      {service}
                    </span>
                  ))}
                  {business.services.length > 4 && (
                    <span className="px-2 py-1 text-slate-400 text-xs">
                      +{business.services.length - 4} more
                    </span>
                  )}
                </div>
              )}

              {/* Create Website Button */}
              <div className="mt-4 pt-4 border-t border-slate-100">
                <button
                  onClick={() => navigate(`/websites/new?business=${business.id}`)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
                >
                  <Sparkles size={16} />
                  Create Website
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Delete Business</h3>
                <p className="text-sm text-slate-500">This will also delete associated websites.</p>
              </div>
            </div>

            <p className="text-slate-600 mb-6">
              Are you sure you want to delete this business? All associated websites and generated content will be permanently removed.
            </p>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteModal(null)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(showDeleteModal)}
                disabled={deleting}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-lg font-medium transition-colors"
              >
                {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Edit Business</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Business Name</label>
                <input
                  type="text"
                  value={showEditModal.business_name}
                  onChange={(e) => setShowEditModal({ ...showEditModal, business_name: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                  <input
                    type="text"
                    value={showEditModal.phone || ''}
                    onChange={(e) => setShowEditModal({ ...showEditModal, phone: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={showEditModal.email || ''}
                    onChange={(e) => setShowEditModal({ ...showEditModal, email: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                <input
                  type="text"
                  value={showEditModal.address_street || ''}
                  onChange={(e) => setShowEditModal({ ...showEditModal, address_street: e.target.value })}
                  placeholder="Street address"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none mb-2"
                />
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={showEditModal.address_city || ''}
                    onChange={(e) => setShowEditModal({ ...showEditModal, address_city: e.target.value })}
                    placeholder="City"
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  />
                  <input
                    type="text"
                    value={showEditModal.address_state || ''}
                    onChange={(e) => setShowEditModal({ ...showEditModal, address_state: e.target.value })}
                    placeholder="State"
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  />
                  <input
                    type="text"
                    value={showEditModal.address_zip || ''}
                    onChange={(e) => setShowEditModal({ ...showEditModal, address_zip: e.target.value })}
                    placeholder="ZIP"
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  value={showEditModal.description || ''}
                  onChange={(e) => setShowEditModal({ ...showEditModal, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => setShowEditModal(null)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSave(showEditModal)}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg font-medium transition-colors"
              >
                {saving && <Loader2 size={16} className="animate-spin" />}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
