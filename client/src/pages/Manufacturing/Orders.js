import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import Card from '../../components/Card';
import { Plus, Play, CheckCircle, Factory, Package, Clock, Trash2, X } from 'lucide-react';

const ManufacturingOrders = () => {
  const { t } = useTranslation();
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    product: '',
    quantity: '',
    manufacturingCost: '',
    notes: ''
  });

  useEffect(() => {
    fetchOrders();
    fetchProducts();
  }, []);

  const fetchOrders = async () => {
    try {
      const response = await axios.get('/api/manufacturing/production-orders');
      setOrders(response.data.data);
    } catch (error) {
      toast.error(t('manufacturing.errors.fetchFailed'));
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const response = await axios.get('/api/inventory/products');
      setProducts(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch products');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/api/manufacturing/production-orders', formData);
      toast.success(t('manufacturing.messages.orderCreated'));
      setShowModal(false);
      setFormData({
        product: '',
        quantity: '',
        manufacturingCost: '',
        notes: ''
      });
      fetchOrders();
    } catch (error) {
      toast.error(error.response?.data?.message || t('manufacturing.errors.createFailed'));
    }
  };

  const handleStart = async (id) => {
    try {
      await axios.put(`/api/manufacturing/production-orders/${id}/start`);
      toast.success(t('manufacturing.messages.productionStarted'));
      fetchOrders();
    } catch (error) {
      toast.error(error.response?.data?.message || t('manufacturing.errors.startFailed'));
    }
  };

  const handleComplete = async (id) => {
    try {
      await axios.put(`/api/manufacturing/production-orders/${id}/complete`);
      toast.success(t('manufacturing.messages.orderCompleted'));
      fetchOrders();
    } catch (error) {
      toast.error(error.response?.data?.message || t('manufacturing.errors.completeFailed'));
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this production order?')) {
      try {
        await axios.delete(`/api/manufacturing/production-orders/${id}`);
        toast.success(t('messages.deleteSuccess'));
        fetchOrders();
      } catch (error) {
        toast.error(error.response?.data?.message || t('manufacturing.errors.deleteFailed'));
      }
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'in-progress': return <Play className="h-5 w-5 text-blue-500" />;
      case 'pending': return <Clock className="h-5 w-5 text-yellow-500" />;
      default: return <Factory className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-green-100 dark:bg-green-500/20 text-green-800 dark:text-green-400';
      case 'in-progress': return 'bg-blue-100 dark:bg-blue-500/20 text-blue-800 dark:text-blue-400';
      case 'pending': return 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-800 dark:text-yellow-400';
      default: return 'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-gray-300';
    }
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('manufacturing.orders.title')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage manufacturing operations and production orders
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600 transition-colors"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Production Order
        </button>
      </div>

      {/* Production Orders */}
      <Card padding={false} className="overflow-hidden">
        <ul className="divide-y divide-gray-200 dark:divide-slate-700">
          {orders.map((order) => (
            <li key={order._id} className="px-4 py-4 hover:bg-gray-50 dark:hover:bg-slate-700/40 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    {getStatusIcon(order.status)}
                  </div>
                  <div className="ml-4">
                    <div className="flex items-center">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {order.orderNumber}
                      </p>
                      <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-500/20 text-blue-800 dark:text-blue-400">
                        {order.product?.name || 'Unknown Product'}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center text-sm text-gray-500 dark:text-gray-400">
                      <span>Quantity: {order.quantity}</span>
                      <span className="mx-2">•</span>
                      <span>Materials: {order.materials.length}</span>
                      {order.manufacturingCost != null && Number(order.manufacturingCost) > 0 && (
                        <>
                          <span className="mx-2">•</span>
                          <span>Mfg cost: ${Number(order.manufacturingCost).toLocaleString()}</span>
                        </>
                      )}
                      {order.startDate && (
                        <>
                          <span className="mx-2">•</span>
                          <span>Started: {new Date(order.startDate).toLocaleDateString()}</span>
                        </>
                      )}
                      {order.endDate && (
                        <>
                          <span className="mx-2">•</span>
                          <span>Completed: {new Date(order.endDate).toLocaleDateString()}</span>
                        </>
                      )}
                    </div>
                    {order.notes && (
                      <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        <span className="font-medium">Notes:</span> {order.notes}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                    {order.status}
                  </span>
                  {order.status === 'pending' && (
                    <button
                      onClick={() => handleStart(order._id)}
                      className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors"
                    >
                      <Play className="h-3 w-3 mr-1" />
                      Start
                    </button>
                  )}
                  {order.status === 'in-progress' && (
                    <button
                      onClick={() => handleComplete(order._id)}
                      className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-white bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 transition-colors"
                    >
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Complete
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(order._id)}
                    className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-500/20 transition-colors"
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 dark:bg-black dark:bg-opacity-70 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border border-gray-200 dark:border-slate-700 w-96 shadow-lg rounded-md bg-white dark:bg-slate-800 transition-colors duration-300">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Create Production Order
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-500 dark:hover:text-gray-300 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Product
                </label>
                <select
                  required
                  value={formData.product}
                  onChange={(e) => setFormData({ ...formData, product: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 dark:border-slate-600 rounded-md shadow-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-primary-500 focus:border-primary-500 transition-colors"
                >
                  <option value="">Select Product</option>
                  {products.filter(p => p.category === 'finished-good' || p.category === 'final-product').map(product => (
                    <option key={product._id} value={product._id}>
                      {product?.name || 'Unknown Product'}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Quantity
                </label>
                <input
                  type="number"
                  required
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 dark:border-slate-600 rounded-md shadow-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-primary-500 focus:border-primary-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Manufacturing Cost ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0"
                  value={formData.manufacturingCost}
                  onChange={(e) => setFormData({ ...formData, manufacturingCost: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 dark:border-slate-600 rounded-md shadow-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-primary-500 focus:border-primary-500 transition-colors"
                />
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
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-700 hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600 transition-colors"
                >
                  Create Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManufacturingOrders;
