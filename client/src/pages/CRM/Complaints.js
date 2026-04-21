import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import Card from '../../components/Card';
import { Plus, AlertCircle, Mail, Phone, Calendar, Edit, Trash2, X, User, FileText, Tag, CheckCircle, Clock, XCircle } from 'lucide-react';

const CRMComplaints = () => {
  const { t } = useTranslation();
  const [complaints, setComplaints] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingComplaint, setEditingComplaint] = useState(null);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [filters, setFilters] = useState({
    status: '',
    priority: '',
    category: ''
  });
  const [formData, setFormData] = useState({
    customer: '',
    subject: '',
    description: '',
    category: 'other',
    priority: 'medium',
    status: 'open',
    relatedOrder: ''
  });

  useEffect(() => {
    fetchComplaints();
    fetchCustomers();
  }, [filters]);

  const fetchComplaints = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.priority) params.append('priority', filters.priority);
      if (filters.category) params.append('category', filters.category);

      const response = await axios.get(`/api/crm/complaints?${params.toString()}`);
      setComplaints(response.data.data || []);
    } catch (error) {
      const errorMessage = error.response?.data?.error || 
                          error.response?.data?.message || 
                          t('crm.complaints.errors.fetchFailed');
      toast.error(errorMessage);
      console.error('Fetch complaints error:', error.response?.data || error);
      setComplaints([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const response = await axios.get('/api/crm/customers');
      setCustomers(response.data.data);
    } catch (error) {
      console.error('Failed to fetch customers:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Prepare data - remove empty strings for optional fields
      const submitData = { ...formData };
      if (!submitData.relatedOrder || submitData.relatedOrder === '') {
        delete submitData.relatedOrder;
      }
      if (editingComplaint) {
        delete submitData.customer;
        await axios.put(`/api/crm/complaints/${editingComplaint._id}`, submitData);
        toast.success(t('messages.updateSuccess'));
      } else {
        await axios.post('/api/crm/complaints', submitData);
        toast.success(t('messages.createSuccess'));
      }
      setShowModal(false);
      setEditingComplaint(null);
      setFormData({
        customer: '',
        subject: '',
        description: '',
        category: 'other',
        priority: 'medium',
        status: 'open',
        relatedOrder: ''
      });
      fetchComplaints();
    } catch (error) {
      const errorMessage = error.response?.data?.error || 
                          error.response?.data?.message || 
                          error.message || 
                          t('crm.complaints.errors.saveFailed');
      toast.error(errorMessage);
      console.error('Complaint submit error:', error.response?.data || error);
    }
  };

  const handleEdit = (complaint) => {
    setEditingComplaint(complaint);
    setFormData({
      customer: complaint.customer._id || complaint.customer,
      subject: complaint.subject,
      description: complaint.description,
      category: complaint.category,
      priority: complaint.priority,
      status: complaint.status,
      relatedOrder: complaint.relatedOrder?._id || complaint.relatedOrder || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm(t('crm.complaints.deleteConfirm'))) {
      try {
        await axios.delete(`/api/crm/complaints/${id}`);
        toast.success(t('messages.deleteSuccess'));
        fetchComplaints();
      } catch (error) {
        const errorMessage = error.response?.data?.error || 
                            error.response?.data?.message || 
                            t('crm.complaints.errors.deleteFailed');
        toast.error(errorMessage);
        console.error('Delete complaint error:', error.response?.data || error);
      }
    }
  };

  const handleViewDetails = async (complaint) => {
    try {
      const response = await axios.get(`/api/crm/complaints/${complaint._id}`);
      setSelectedComplaint(response.data.data);
      setShowDetailModal(true);
    } catch (error) {
      const errorMessage = error.response?.data?.error || 
                          error.response?.data?.message || 
                          t('crm.complaints.errors.fetchDetailsFailed');
      toast.error(errorMessage);
      console.error('Fetch complaint details error:', error.response?.data || error);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'resolved': return 'bg-green-100 dark:bg-green-500/20 text-green-800 dark:text-green-400';
      case 'closed': return 'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-gray-300';
      case 'in-progress': return 'bg-blue-100 dark:bg-blue-500/20 text-blue-800 dark:text-blue-400';
      case 'open': return 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-800 dark:text-yellow-400';
      case 'cancelled': return 'bg-red-100 dark:bg-red-500/20 text-red-800 dark:text-red-400';
      default: return 'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-gray-300';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 dark:bg-red-500/20 text-red-800 dark:text-red-400';
      case 'high': return 'bg-orange-100 dark:bg-orange-500/20 text-orange-800 dark:text-orange-400';
      case 'medium': return 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-800 dark:text-yellow-400';
      case 'low': return 'bg-green-100 dark:bg-green-500/20 text-green-800 dark:text-green-400';
      default: return 'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-gray-300';
    }
  };

  const getCategoryLabel = (category) => {
    const labels = {
      'product-quality': 'Product Quality',
      'delivery': 'Delivery',
      'billing': 'Billing',
      'service': 'Service',
      'other': 'Other'
    };
    return labels[category] || category;
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('crm.complaints.title')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t('crm.complaints.description')}
          </p>
        </div>
        <button
          onClick={() => {
            setEditingComplaint(null);
            setFormData({
              customer: '',
              subject: '',
              description: '',
              category: 'other',
              priority: 'medium',
              status: 'open',
              relatedOrder: ''
            });
            setShowModal(true);
          }}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600 transition-colors"
        >
          <Plus className="h-4 w-4 mr-2" />
          {t('crm.complaints.addComplaint')}
        </button>
      </div>

      {/* Filters */}
      <Card paddingSize="sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('common.status')}</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="block w-full border border-gray-300 dark:border-slate-600 rounded-md shadow-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-primary-500 focus:border-primary-500 transition-colors"
            >
              <option value="">{t('crm.complaints.allStatuses')}</option>
              <option value="open">{t('crm.complaints.status.open')}</option>
              <option value="in-progress">{t('crm.complaints.status.in-progress')}</option>
              <option value="resolved">{t('crm.complaints.status.resolved')}</option>
              <option value="closed">{t('crm.complaints.status.closed')}</option>
              <option value="cancelled">{t('crm.complaints.status.cancelled')}</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('common.priority')}</label>
            <select
              value={filters.priority}
              onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
              className="block w-full border border-gray-300 dark:border-slate-600 rounded-md shadow-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-primary-500 focus:border-primary-500 transition-colors"
            >
              <option value="">{t('crm.complaints.allPriorities')}</option>
              <option value="urgent">{t('crm.complaints.priority.urgent')}</option>
              <option value="high">{t('crm.complaints.priority.high')}</option>
              <option value="medium">{t('crm.complaints.priority.medium')}</option>
              <option value="low">{t('crm.complaints.priority.low')}</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('common.category')}</label>
            <select
              value={filters.category}
              onChange={(e) => setFilters({ ...filters, category: e.target.value })}
              className="block w-full border border-gray-300 dark:border-slate-600 rounded-md shadow-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-primary-500 focus:border-primary-500 transition-colors"
            >
              <option value="">{t('crm.complaints.allCategories')}</option>
              <option value="product-quality">{t('crm.complaints.category.product-quality')}</option>
              <option value="delivery">{t('crm.complaints.category.delivery')}</option>
              <option value="billing">{t('crm.complaints.category.billing')}</option>
              <option value="service">{t('crm.complaints.category.service')}</option>
              <option value="other">{t('crm.complaints.category.other')}</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Complaints List */}
      <Card padding={false} className="overflow-hidden">
        {complaints.length === 0 ? (
          <div className="text-center py-12">
            <AlertCircle className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">{t('crm.complaints.noComplaints')}</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-200 dark:divide-slate-700">
            {complaints.map((complaint) => (
              <li key={complaint._id} className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-slate-700/40 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center">
                      <AlertCircle className="h-5 w-5 text-red-500 dark:text-red-400 mr-2" />
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                        {complaint.complaintNumber} - {complaint.subject}
                      </h3>
                    </div>
                    <div className="mt-2 flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
                      <div className="flex items-center">
                        <User className="h-4 w-4 mr-1" />
                        <span>{complaint.customer?.name || t('sales.orders.unknownCustomer')}</span>
                      </div>
                      {complaint.customer?.email && (
                        <div className="flex items-center">
                          <Mail className="h-4 w-4 mr-1" />
                          <span>{complaint.customer.email}</span>
                        </div>
                      )}
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 mr-1" />
                        <span>{formatDate(complaint.createdAt)}</span>
                      </div>
                    </div>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
                      {complaint.description}
                    </p>
                  </div>
                  <div className="ml-4 flex items-center space-x-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(complaint.priority)}`}>
                      {complaint.priority}
                    </span>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(complaint.status)}`}>
                      {complaint.status}
                    </span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-gray-300">
                      {getCategoryLabel(complaint.category)}
                    </span>
                    <button
                      onClick={() => handleViewDetails(complaint)}
                      className="text-primary-600 dark:text-primary-400 hover:text-primary-900 dark:hover:text-primary-300 transition-colors"
                      title={t('common.viewDetails')}
                    >
                      <FileText className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleEdit(complaint)}
                      className="text-primary-600 dark:text-primary-400 hover:text-primary-900 dark:hover:text-primary-300 transition-colors"
                      title={t('common.edit')}
                    >
                      <Edit className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(complaint._id)}
                      className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 transition-colors"
                      title={t('common.delete')}
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 dark:bg-black dark:bg-opacity-70 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border border-gray-200 dark:border-slate-700 w-full max-w-2xl shadow-lg rounded-md bg-white dark:bg-slate-800 transition-colors duration-300">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                {editingComplaint ? t('crm.complaints.editComplaint') : t('crm.complaints.addComplaint')}
              </h3>
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingComplaint(null);
                }}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-500 dark:hover:text-gray-300 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Customer *
                </label>
                <select
                  required
                  disabled={!!editingComplaint}
                  value={formData.customer}
                  onChange={(e) => setFormData({ ...formData, customer: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 dark:border-slate-600 rounded-md shadow-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-primary-500 focus:border-primary-500 transition-colors disabled:opacity-70 disabled:cursor-not-allowed disabled:bg-gray-100 dark:disabled:bg-slate-800/80"
                >
                  <option value="">{t('crm.complaints.selectCustomer')}</option>
                  {customers.map((customer) => (
                    <option key={customer._id} value={customer._id}>
                      {customer.name} {customer.company ? `- ${customer.company}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Subject *
                </label>
                <input
                  type="text"
                  required
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 dark:border-slate-600 rounded-md shadow-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-primary-500 focus:border-primary-500 transition-colors"
                  placeholder={t('crm.complaints.subjectPlaceholder')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Description *
                </label>
                <textarea
                  required
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={4}
                  className="mt-1 block w-full border border-gray-300 dark:border-slate-600 rounded-md shadow-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-primary-500 focus:border-primary-500 transition-colors"
                  placeholder={t('crm.complaints.descriptionPlaceholder')}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Category
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 dark:border-slate-600 rounded-md shadow-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-primary-500 focus:border-primary-500 transition-colors"
                  >
                    <option value="product-quality">{t('crm.complaints.category.product-quality')}</option>
                    <option value="delivery">{t('crm.complaints.category.delivery')}</option>
                    <option value="billing">{t('crm.complaints.category.billing')}</option>
                    <option value="service">{t('crm.complaints.category.service')}</option>
                    <option value="other">{t('crm.complaints.category.other')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Priority
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 dark:border-slate-600 rounded-md shadow-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-primary-500 focus:border-primary-500 transition-colors"
                  >
                    <option value="low">{t('crm.complaints.priority.low')}</option>
                    <option value="medium">{t('crm.complaints.priority.medium')}</option>
                    <option value="high">{t('crm.complaints.priority.high')}</option>
                    <option value="urgent">{t('crm.complaints.priority.urgent')}</option>
                  </select>
                </div>
              </div>
              {editingComplaint && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 dark:border-slate-600 rounded-md shadow-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-primary-500 focus:border-primary-500 transition-colors"
                  >
                    <option value="open">{t('crm.complaints.status.open')}</option>
                    <option value="in-progress">{t('crm.complaints.status.in-progress')}</option>
                    <option value="resolved">{t('crm.complaints.status.resolved')}</option>
                    <option value="closed">{t('crm.complaints.status.closed')}</option>
                    <option value="cancelled">{t('crm.complaints.status.cancelled')}</option>
                  </select>
                </div>
              )}
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingComplaint(null);
                  }}
                  className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-700 hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600 transition-colors"
                >
                  {editingComplaint ? t('common.update') : t('common.create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedComplaint && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 dark:bg-black dark:bg-opacity-70 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border border-gray-200 dark:border-slate-700 w-11/12 max-w-4xl shadow-lg rounded-md bg-white dark:bg-slate-800 transition-colors duration-300">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-xl font-medium text-gray-900 dark:text-white">
                  {selectedComplaint.complaintNumber} - {selectedComplaint.subject}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Created: {formatDate(selectedComplaint.createdAt)}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  setSelectedComplaint(null);
                }}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-500 dark:hover:text-gray-300 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Status and Priority */}
              <div className="flex items-center space-x-4">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(selectedComplaint.status)}`}>
                  {selectedComplaint.status}
                </span>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getPriorityColor(selectedComplaint.priority)}`}>
                  {selectedComplaint.priority}
                </span>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-gray-300">
                  {getCategoryLabel(selectedComplaint.category)}
                </span>
              </div>

              {/* Customer Info */}
              <Card paddingSize="sm">
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">{t('crm.complaints.customerInformation')}</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">{t('common.name')}:</span>
                    <span className="ml-2 text-gray-900 dark:text-white">{selectedComplaint.customer?.name}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">{t('common.email')}:</span>
                    <span className="ml-2 text-gray-900 dark:text-white">{selectedComplaint.customer?.email}</span>
                  </div>
                  {selectedComplaint.customer?.phone && (
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">{t('common.phone')}:</span>
                      <span className="ml-2 text-gray-900 dark:text-white">{selectedComplaint.customer.phone}</span>
                    </div>
                  )}
                  {selectedComplaint.customer?.company && (
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">{t('crm.customers.company')}:</span>
                      <span className="ml-2 text-gray-900 dark:text-white">{selectedComplaint.customer.company}</span>
                    </div>
                  )}
                </div>
              </Card>

              {/* Description */}
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">{t('common.description')}</h4>
                <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{selectedComplaint.description}</p>
              </div>

              {/* Resolution */}
              {selectedComplaint.resolution && (
                <Card paddingSize="sm" className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2">{t('crm.complaints.resolution')}</h4>
                  <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{selectedComplaint.resolution}</p>
                  {selectedComplaint.resolvedAt && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                      Resolved on: {formatDate(selectedComplaint.resolvedAt)}
                    </p>
                  )}
                </Card>
              )}

              {/* Notes */}
              {selectedComplaint.notes && selectedComplaint.notes.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2">{t('common.notes')}</h4>
                  <div className="space-y-2">
                    {selectedComplaint.notes.map((note, idx) => (
                      <Card key={idx} paddingSize="sm">
                        <p className="text-gray-700 dark:text-gray-300">{note.note}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {formatDate(note.addedAt)}
                        </p>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CRMComplaints;

