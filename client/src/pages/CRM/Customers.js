import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import Card from '../../components/Card';
import { Plus, UserCheck, Mail, Phone, Building, Edit, Trash2, History, X, Calendar, DollarSign, Package, Search } from 'lucide-react';
import { isValidPhone } from '../../utils/phoneValidation';

const CRMCustomers = () => {
  const { t } = useTranslation();
  const [customers, setCustomers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [salesHistory, setSalesHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [customerStats, setCustomerStats] = useState({});
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    customerType: 'individual',
    creditLimit: '',
    paymentTerms: 'Net 30',
    address: {
      street: '',
      city: '',
      state: '',
      zipCode: '',
      country: ''
    },
    notes: ''
  });

  useEffect(() => {
    fetchCustomers();
  }, []);

  useEffect(() => {
    // Fetch sales statistics for all customers
    if (customers.length > 0) {
      fetchCustomerStats();
    }
  }, [customers]);

  const fetchCustomers = async () => {
    try {
      const response = await axios.get('/api/crm/customers');
      setCustomers(response.data.data);
    } catch (error) {
      toast.error(t('crm.errors.fetchFailed'));
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomerStats = async () => {
    try {
      const statsMap = {};
      await Promise.all(
        customers.map(async (customer) => {
          try {
            const response = await axios.get(`/api/crm/customers/${customer._id}/orders`);
            const orders = response.data.data || [];
            const totalSpent = orders.reduce((sum, order) => sum + (order.total || 0), 0);
            statsMap[customer._id] = {
              totalOrders: orders.length,
              totalSpent: totalSpent
            };
          } catch (error) {
            statsMap[customer._id] = {
              totalOrders: 0,
              totalSpent: 0
            };
          }
        })
      );
      setCustomerStats(statsMap);
    } catch (error) {
      console.error('Failed to fetch customer stats:', error);
    }
  };

  const fetchSalesHistory = async (customerId) => {
    setLoadingHistory(true);
    try {
      const response = await axios.get(`/api/crm/customers/${customerId}/orders`);
      setSalesHistory(response.data.data || []);
    } catch (error) {
      toast.error(t('crm.errors.fetchHistoryFailed'));
      setSalesHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleViewHistory = (customer) => {
    setSelectedCustomer(customer);
    setShowHistoryModal(true);
    fetchSalesHistory(customer._id);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isValidPhone(formData.phone)) {
      toast.error(t('validation.phoneInvalid'));
      return;
    }
    try {
      // Ensure creditLimit is a number
      const submitData = {
        ...formData,
        creditLimit: formData.creditLimit ? Number(formData.creditLimit) : 0
      };
      
      if (editingCustomer) {
        await axios.put(`/api/crm/customers/${editingCustomer._id}`, submitData);
        toast.success(t('messages.updateSuccess'));
      } else {
        await axios.post('/api/crm/customers', submitData);
        toast.success(t('messages.createSuccess'));
      }
      setShowModal(false);
      setEditingCustomer(null);
      setFormData({
        name: '',
        email: '',
        phone: '',
        company: '',
        customerType: 'individual',
        creditLimit: '',
        paymentTerms: 'Net 30',
        address: {
          street: '',
          city: '',
          state: '',
          zipCode: '',
          country: ''
        },
        notes: ''
      });
      fetchCustomers();
    } catch (error) {
      toast.error(error.response?.data?.message || t('crm.errors.saveFailed'));
    }
  };

  const handleEdit = (customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      company: customer.company || '',
      customerType: customer.customerType,
      creditLimit: customer.creditLimit,
      paymentTerms: customer.paymentTerms,
      address: customer.address || {
        street: '',
        city: '',
        state: '',
        zipCode: '',
        country: ''
      },
      notes: customer.notes || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm(t('crm.customers.deleteConfirm'))) {
      try {
        await axios.delete(`/api/crm/customers/${id}`);
        toast.success(t('messages.deleteSuccess'));
        fetchCustomers();
      } catch (error) {
        console.error('Delete error:', error);
        toast.error(error.response?.data?.message || t('crm.errors.deleteFailed'));
      }
    }
  };

  const getCustomerTypeColor = (type) => {
    switch (type) {
      case 'business': return 'bg-blue-100 dark:bg-blue-500/20 text-blue-800 dark:text-blue-400';
      case 'individual': return 'bg-green-100 dark:bg-green-500/20 text-green-800 dark:text-green-400';
      default: return 'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-gray-300';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'delivered': return 'bg-green-100 dark:bg-green-500/20 text-green-800 dark:text-green-400';
      case 'shipped': return 'bg-blue-100 dark:bg-blue-500/20 text-blue-800 dark:text-blue-400';
      case 'confirmed': return 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-800 dark:text-yellow-400';
      case 'in-production': return 'bg-purple-100 dark:bg-purple-500/20 text-purple-800 dark:text-purple-400';
      case 'pending': return 'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-gray-300';
      case 'cancelled': return 'bg-red-100 dark:bg-red-500/20 text-red-800 dark:text-red-400';
      default: return 'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-gray-300';
    }
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Customers</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t('crm.customers.description')}
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600 transition-colors"
        >
          <Plus className="h-4 w-4 mr-2" />
          {t('crm.customers.addCustomer')}
        </button>
      </div>

      {/* Search Bar */}
      <Card paddingSize="sm">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400 dark:text-gray-500" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('crm.customers.searchPlaceholder')}
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
          />
        </div>
      </Card>

      {/* Customers Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {customers
          .filter((customer) => {
            if (!searchQuery) return true;
            const name = customer.name || '';
            return name.toLowerCase().includes(searchQuery.toLowerCase());
          })
          .map((customer) => (
          <Card key={customer._id}>
            <div className="p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <UserCheck className="h-8 w-8 text-gray-400 dark:text-gray-500" />
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">{customer.name}</h3>
                    {customer.company && (
                      <p className="text-sm text-gray-500 dark:text-gray-400">{customer.company}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleEdit(customer)}
                    className="text-primary-600 dark:text-primary-400 hover:text-primary-900 dark:hover:text-primary-300 transition-colors"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(customer._id)}
                    className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              
              <div className="mt-4">
                <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                  <Mail className="h-4 w-4 mr-2" />
                  <span>{customer.email}</span>
                </div>
                <div className="mt-1 flex items-center text-sm text-gray-500 dark:text-gray-400">
                  <Phone className="h-4 w-4 mr-2" />
                  <span>{customer.phone}</span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getCustomerTypeColor(customer.customerType)}`}>
                    {customer.customerType}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">${customer.creditLimit ? customer.creditLimit.toLocaleString() : '0'}</span>
                </div>
                {customer.address && (
                  <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    <span>{customer.address.city}, {customer.address.state}</span>
                  </div>
                )}
                {customerStats[customer._id] && (
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-slate-700">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center text-gray-600 dark:text-gray-400">
                        <Package className="h-3 w-3 mr-1" />
                        <span>{customerStats[customer._id].totalOrders} orders</span>
                      </div>
                      <div className="flex items-center text-gray-600 dark:text-gray-400">
                        <DollarSign className="h-3 w-3 mr-1" />
                        <span>${customerStats[customer._id].totalSpent.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                )}
                <div className="mt-3">
                  <button
                    onClick={() => handleViewHistory(customer)}
                    className="w-full inline-flex items-center justify-center px-3 py-2 border border-gray-300 dark:border-slate-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-700 hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors"
                  >
                    <History className="h-4 w-4 mr-2" />
                    View Sales History
                  </button>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 dark:bg-black dark:bg-opacity-70 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border border-gray-200 dark:border-slate-700 w-96 shadow-lg rounded-md bg-white dark:bg-slate-800 transition-colors duration-300">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                {editingCustomer ? 'Edit Customer' : 'Add Customer'}
              </h3>
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingCustomer(null);
                }}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-500 dark:hover:text-gray-300 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Customer Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 dark:border-slate-600 rounded-md shadow-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-primary-500 focus:border-primary-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 dark:border-slate-600 rounded-md shadow-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-primary-500 focus:border-primary-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Phone
                </label>
                <input
                  type="tel"
                  required
                  autoComplete="tel"
                  inputMode="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 dark:border-slate-600 rounded-md shadow-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-primary-500 focus:border-primary-500 transition-colors"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t('validation.phoneHint')}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Customer Type
                </label>
                <select
                  value={formData.customerType}
                  onChange={(e) => setFormData({ ...formData, customerType: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 dark:border-slate-600 rounded-md shadow-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-primary-500 focus:border-primary-500 transition-colors"
                >
                  <option value="individual">Individual</option>
                  <option value="business">Business</option>
                </select>
              </div>
              {formData.customerType === 'business' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Company
                  </label>
                  <input
                    type="text"
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 dark:border-slate-600 rounded-md shadow-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-primary-500 focus:border-primary-500 transition-colors"
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Credit Limit
                  </label>
                  <input
                    type="number"
                    value={formData.creditLimit}
                    onChange={(e) => setFormData({ ...formData, creditLimit: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 dark:border-slate-600 rounded-md shadow-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-primary-500 focus:border-primary-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Payment Terms
                  </label>
                  <select
                    value={formData.paymentTerms}
                    onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 dark:border-slate-600 rounded-md shadow-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-primary-500 focus:border-primary-500 transition-colors"
                  >
                    <option value="Net 15">Net 15</option>
                    <option value="Net 30">Net 30</option>
                    <option value="Net 45">Net 45</option>
                    <option value="Net 60">Net 60</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="mt-1 block w-full border border-gray-300 dark:border-slate-600 rounded-md shadow-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-primary-500 focus:border-primary-500 transition-colors"
                />
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingCustomer(null);
                  }}
                  className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-700 hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600 transition-colors"
                >
                  {editingCustomer ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sales History Modal */}
      {showHistoryModal && selectedCustomer && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 dark:bg-black dark:bg-opacity-70 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border border-gray-200 dark:border-slate-700 w-11/12 max-w-4xl shadow-lg rounded-md bg-white dark:bg-slate-800 transition-colors duration-300">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-xl font-medium text-gray-900 dark:text-white">
                  Sales History - {selectedCustomer.name}
                </h3>
                {selectedCustomer.company && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{selectedCustomer.company}</p>
                )}
              </div>
              <button
                onClick={() => {
                  setShowHistoryModal(false);
                  setSelectedCustomer(null);
                  setSalesHistory([]);
                }}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-500 dark:hover:text-gray-300 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {loadingHistory ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
              </div>
            ) : salesHistory.length === 0 ? (
              <div className="text-center py-12">
                <History className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">No sales history found for this customer</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Summary Stats */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <Card paddingSize="sm">
                    <div className="text-sm text-gray-500 dark:text-gray-400">Total Orders</div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">{salesHistory.length}</div>
                  </Card>
                  <Card paddingSize="sm">
                    <div className="text-sm text-gray-500 dark:text-gray-400">Total Spent</div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      ${salesHistory.reduce((sum, order) => sum + (order.total || 0), 0).toLocaleString()}
                    </div>
                  </Card>
                  <Card paddingSize="sm">
                    <div className="text-sm text-gray-500 dark:text-gray-400">Average Order</div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      ${salesHistory.length > 0 
                        ? (salesHistory.reduce((sum, order) => sum + (order.total || 0), 0) / salesHistory.length).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        : '0.00'}
                    </div>
                  </Card>
                </div>

                {/* Orders List */}
                <Card padding={false} className="overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                      <thead className="bg-gray-50 dark:bg-slate-700">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Order Number
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Date
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Items
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Total
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
                        {salesHistory.map((order) => (
                          <tr key={order._id} className="hover:bg-gray-50 dark:hover:bg-slate-700/40 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                              {order.orderNumber}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                              <div className="flex items-center">
                                <Calendar className="h-4 w-4 mr-1" />
                                {formatDate(order.orderDate)}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                              {order.items && order.items.length > 0 ? (
                                <div>
                                  {order.items.map((item, idx) => (
                                    <div key={idx} className="mb-1">
                                      {item.product?.name || 'Unknown Product'} 
                                      <span className="text-gray-400 dark:text-gray-500"> x {item.quantity}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-gray-400 dark:text-gray-500">No items</span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                                {order.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                              ${order.total ? order.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CRMCustomers;
