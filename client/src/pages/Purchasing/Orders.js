import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import Card from '../../components/Card';
import { Plus, ShoppingBag, CheckCircle, Clock, Truck, Edit, Trash2, FileText, Printer, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { canCreatePurchaseOrder, canEditPurchaseOrder, canAcceptPurchaseOrder, canReceivePurchaseOrder, canDeletePurchaseOrder } from '../../config/permissions';

const PurchasingOrders = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const [invoiceData, setInvoiceData] = useState(null);
  const [loadingInvoice, setLoadingInvoice] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [formData, setFormData] = useState({
    supplier: '',
    items: [{ product: '', quantity: '' }],
    expectedDelivery: '',
    notes: ''
  });

  useEffect(() => {
    fetchOrders();
    fetchSuppliers();
    fetchProducts();
  }, []);

  const fetchOrders = async () => {
    try {
      const response = await axios.get('/api/purchasing/orders');
      setOrders(response.data.data);
    } catch (error) {
      toast.error(t('purchasing.errors.fetchFailed'));
    } finally {
      setLoading(false);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const response = await axios.get('/api/scm/suppliers');
      setSuppliers(response.data.data);
    } catch (error) {
      console.error('Failed to fetch suppliers');
    }
  };

  const fetchProducts = async () => {
    try {
      const response = await axios.get('/api/inventory/products?category=raw-material');
      setProducts(response.data.data);
    } catch (error) {
      console.error('Failed to fetch products');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Ensure all required fields are properly formatted
      const submitData = {
        ...formData,
        items: formData.items
          .map((item) => ({
            product: item.product,
            quantity: Number(item.quantity)
          }))
          .filter((item) => item.product && item.quantity > 0),
        expectedDelivery: formData.expectedDelivery ? new Date(formData.expectedDelivery).toISOString() : null
      };

      // Validate that we have at least one valid item
      if (submitData.items.length === 0) {
        toast.error(t('purchasing.errors.addItemRequired'));
        return;
      }

      if (editingOrder) {
        await axios.put(`/api/purchasing/orders/${editingOrder._id}`, submitData);
        toast.success(t('messages.updateSuccess'));
      } else {
        await axios.post('/api/purchasing/orders', submitData);
        toast.success(t('purchasing.messages.orderCreated'));
      }
      
      setShowModal(false);
      setEditingOrder(null);
      setFormData({
        supplier: '',
        items: [{ product: '', quantity: '' }],
        expectedDelivery: '',
        notes: ''
      });
      fetchOrders();
    } catch (error) {
      toast.error(error.response?.data?.message || (editingOrder ? t('purchasing.errors.updateFailed') : t('purchasing.errors.createFailed')));
    }
  };

  const handleOrder = async (id) => {
    try {
      await axios.put(`/api/purchasing/orders/${id}/order`);
      toast.success(t('purchasing.messages.orderConfirmed'));
      fetchOrders();
    } catch (error) {
      toast.error(error.response?.data?.message || t('purchasing.errors.confirmFailed'));
    }
  };

  const handleReceive = async (id) => {
    try {
      await axios.put(`/api/purchasing/orders/${id}/receive`);
      toast.success(t('purchasing.messages.orderReceived'));
      fetchOrders();
    } catch (error) {
      toast.error(error.response?.data?.message || t('purchasing.errors.receiveFailed'));
    }
  };

  const handleEdit = (order) => {
    setEditingOrder(order);
    setFormData({
      supplier: order.supplier._id,
      items: order.items.map((item) => ({
        product: item.product._id,
        quantity: item.quantity
      })),
      expectedDelivery: order.expectedDelivery ? new Date(order.expectedDelivery).toISOString().split('T')[0] : '',
      notes: order.notes || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this purchase order?')) {
      try {
        await axios.delete(`/api/purchasing/orders/${id}`);
        toast.success(t('purchasing.messages.orderDeleted'));
        fetchOrders();
      } catch (error) {
        toast.error(error.response?.data?.message || t('purchasing.errors.deleteFailed'));
      }
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingOrder(null);
    setFormData({
      supplier: '',
      items: [{ product: '', quantity: '' }],
      expectedDelivery: '',
      notes: ''
    });
  };

  const handleViewInvoice = async (orderId) => {
    setLoadingInvoice(true);
    try {
      const response = await axios.get(`/api/purchasing/invoices/${orderId}`);
      setInvoiceData(response.data.data);
      setShowInvoice(true);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load invoice');
    } finally {
      setLoadingInvoice(false);
    }
  };

  const handlePrintInvoice = () => {
    window.print();
  };


  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { product: '', quantity: '' }]
    });
  };

  const removeItem = (index) => {
    setFormData({
      ...formData,
      items: formData.items.filter((_, i) => i !== index)
    });
  };

  const updateItem = (index, field, value) => {
    const updatedItems = [...formData.items];
    updatedItems[index][field] = value;
    setFormData({ ...formData, items: updatedItems });
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'received': return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'ordered': return <Truck className="h-5 w-5 text-blue-500" />;
      case 'pending': return <Clock className="h-5 w-5 text-yellow-500" />;
      default: return <ShoppingBag className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'received': return 'bg-green-100 dark:bg-green-500/20 text-green-800 dark:text-green-400';
      case 'ordered': return 'bg-blue-100 dark:bg-blue-500/20 text-blue-800 dark:text-blue-400';
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('purchasing.orders.title')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t('purchasing.orders.description')}
          </p>
        </div>
        {canCreatePurchaseOrder(user) && (
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600 transition-colors"
          >
            <Plus className="h-4 w-4 mr-2" />
            {t('purchasing.orders.newOrder')}
          </button>
        )}
      </div>

      {/* Purchase Orders */}
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
                      {order.autoGenerated && (
                        <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-500/20 text-yellow-800 dark:text-yellow-400">
                          Auto (Inventory)
                        </span>
                      )}
                      {!order.autoGenerated && (
                        <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-500/20 text-blue-800 dark:text-blue-400">
                          Manual
                        </span>
                      )}
                      <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-gray-300">
                        {order.supplier?.name || t('purchasing.orders.unknownSupplier')}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center text-sm text-gray-500 dark:text-gray-400">
                      <span>Total: ${order.total.toLocaleString()}</span>
                      <span className="mx-2">•</span>
                      <span>Items: {order.items.length}</span>
                      <span className="mx-2">•</span>
                      <span>Date: {new Date(order.orderDate).toLocaleDateString()}</span>
                      {order.expectedDelivery && (
                        <>
                          <span className="mx-2">•</span>
                          <span>Expected: {new Date(order.expectedDelivery).toLocaleDateString()}</span>
                        </>
                      )}
                    </div>
                    <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      <span className="font-medium">{t('purchasing.orders.items')}:</span> {order.items.map(item => 
                        `${item.product?.name || t('common.unknownProduct')} (${item.quantity})`
                      ).join(', ')}
                    </div>
                    {order.notes && (
                      <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        <span className="font-medium">{t('common.notes')}:</span> {order.notes}
                      </div>
                    )}
                    {order.autoGenerated && (
                      <div className="mt-2 px-3 py-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
                        <p className="text-xs text-yellow-800 dark:text-yellow-300">
                          <span className="font-semibold">{t('purchasing.dashboard.autoGenerated')}:</span> {t('purchasing.orders.autoGeneratedHint')}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleViewInvoice(order._id)}
                    disabled={loadingInvoice}
                    className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-500/20 transition-colors"
                    title={t('common.viewInvoice')}
                  >
                    <FileText className="h-3 w-3 mr-1" />
                    {t('common.invoice')}
                  </button>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                    {order.status}
                  </span>
                  {order.status === 'pending' && canAcceptPurchaseOrder(user) && (
                    <button
                      onClick={() => handleOrder(order._id)}
                      className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors"
                    >
                      <Truck className="h-3 w-3 mr-1" />
                      Order
                    </button>
                  )}
                  {order.status === 'ordered' && canReceivePurchaseOrder(user) && (
                    <button
                      onClick={() => handleReceive(order._id)}
                      className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-white bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 transition-colors"
                    >
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Receive
                    </button>
                  )}
                  {order.status === 'pending' && canEditPurchaseOrder(user) && (
                    <button
                      onClick={() => handleEdit(order)}
                      className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-500/20 transition-colors"
                    >
                      <Edit className="h-3 w-3 mr-1" />
                      Edit
                    </button>
                  )}
                  {canDeletePurchaseOrder(user) && (
                    <button
                      onClick={() => handleDelete(order._id)}
                      className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-500/20 transition-colors"
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 dark:bg-black dark:bg-opacity-70 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border border-gray-200 dark:border-slate-700 w-full max-w-2xl shadow-lg rounded-md bg-white dark:bg-slate-800 transition-colors duration-300">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                {editingOrder ? t('purchasing.orders.editOrder') : t('purchasing.orders.createOrder')}
              </h3>
              <button
                onClick={handleCloseModal}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-500 dark:hover:text-gray-300 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Supplier *
                </label>
                <select
                  required
                  value={formData.supplier}
                  onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 dark:border-slate-600 rounded-md shadow-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-primary-500 focus:border-primary-500 transition-colors"
                >
                  <option value="">{t('purchasing.orders.selectSupplier')}</option>
                  {suppliers.map(supplier => (
                    <option key={supplier._id} value={supplier._id}>
                      {supplier?.name || t('purchasing.orders.unknownSupplier')}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Items
                </label>
                {formData.items.map((item, index) => (
                  <div key={index} className="flex space-x-2 mb-2">
                    <select
                      value={item.product}
                      onChange={(e) => updateItem(index, 'product', e.target.value)}
                      className="flex-1 border border-gray-300 dark:border-slate-600 rounded-md shadow-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-primary-500 focus:border-primary-500 transition-colors"
                    >
                      <option value="">{t('purchasing.orders.selectProduct')}</option>
                      {products.map((product) => (
                        <option key={product._id} value={product._id}>
                          {product?.name || t('common.unknownProduct')}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      placeholder={t('purchasing.orders.qty')}
                      value={item.quantity}
                      onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                      className="w-24 border border-gray-300 dark:border-slate-600 rounded-md shadow-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-primary-500 focus:border-primary-500 transition-colors"
                      min="1"
                      required
                    />
                    {formData.items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition-colors"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addItem}
                  className="inline-flex items-center text-sm text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300 transition-colors"
                >
                  <Plus className="h-4 w-4 mr-1" /> Add Item
                </button>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Expected Delivery Date
                </label>
                <input
                  type="date"
                  value={formData.expectedDelivery}
                  onChange={(e) => setFormData({ ...formData, expectedDelivery: e.target.value })}
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
                  placeholder={t('purchasing.orders.notesPlaceholder')}
                />
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-700 hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600 transition-colors"
                >
                  {editingOrder ? t('purchasing.orders.updateOrder') : t('purchasing.orders.createOrder')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invoice Modal */}
      {showInvoice && invoiceData && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 dark:bg-black dark:bg-opacity-70 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border border-gray-200 dark:border-slate-700 w-full max-w-4xl shadow-lg rounded-md bg-white dark:bg-slate-800 print:shadow-none transition-colors duration-300">
            <div className="mb-4 flex justify-between items-center print:hidden">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">{t('purchasing.orders.purchaseInvoice')}</h3>
              <div className="flex space-x-2">
                <button
                  onClick={handlePrintInvoice}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors"
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Print
                </button>
                <button
                  onClick={() => {
                    setShowInvoice(false);
                    setInvoiceData(null);
                  }}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-slate-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-700 hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors"
                >
                  <X className="h-4 w-4 mr-2" />
                  Close
                </button>
              </div>
            </div>
            
            {/* Invoice Content */}
            <div className="bg-white dark:bg-slate-800 p-8 print:p-4">
              {/* Header */}
              <div className="mb-8 border-b-2 border-gray-300 dark:border-slate-700 pb-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">{t('common.brandName')}</h1>
                    <p className="text-gray-600 dark:text-gray-300">{t('purchasing.orders.purchaseInvoice')}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600 dark:text-gray-300">{t('purchasing.orders.invoiceNo')}: <span className="font-semibold">{invoiceData.invoiceNumber}</span></p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">{t('purchasing.orders.orderNo')}: <span className="font-semibold">{invoiceData.purchaseOrder?.orderNumber || t('common.unknown')}</span></p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">{t('common.date')}: <span className="font-semibold">{new Date(invoiceData.invoiceDate).toLocaleDateString()}</span></p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">{t('sales.orders.dueDate')}: <span className="font-semibold">{new Date(invoiceData.dueDate).toLocaleDateString()}</span></p>
                  </div>
                </div>
              </div>

              {/* Bill From (Supplier) */}
              <div className="mb-8 grid grid-cols-2 gap-8">
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('purchasing.orders.billFrom')}:</h3>
                  <p className="text-sm text-gray-900 dark:text-white font-medium">{invoiceData.supplier?.name || 'N/A'}</p>
                  {invoiceData.supplier?.contactPerson && (
                    <p className="text-sm text-gray-600 dark:text-gray-300">{invoiceData.supplier.contactPerson}</p>
                  )}
                  {invoiceData.supplier?.address && (
                    <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                      {invoiceData.supplier.address.street && <p>{invoiceData.supplier.address.street}</p>}
                      {invoiceData.supplier.address.city && (
                        <p>
                          {invoiceData.supplier.address.city}
                          {invoiceData.supplier.address.state && `, ${invoiceData.supplier.address.state}`}
                          {invoiceData.supplier.address.zipCode && ` ${invoiceData.supplier.address.zipCode}`}
                        </p>
                      )}
                      {invoiceData.supplier.address.country && <p>{invoiceData.supplier.address.country}</p>}
                    </div>
                  )}
                  {invoiceData.supplier?.email && (
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{invoiceData.supplier.email}</p>
                  )}
                  {invoiceData.supplier?.phone && (
                    <p className="text-sm text-gray-600 dark:text-gray-300">{invoiceData.supplier.phone}</p>
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('sales.orders.paymentTerms')}:</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">{invoiceData.paymentTerms || 'Net 30'}</p>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 mt-4">{t('common.status')}:</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300 capitalize">{invoiceData.status}</p>
                </div>
              </div>

              {/* Items Table */}
              <div className="mb-8">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                  <thead className="bg-gray-50 dark:bg-slate-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t('sales.orders.item')}</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t('sales.orders.quantity')}</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t('purchasing.orders.lineTotal')}</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
                    {invoiceData.items.map((item, index) => (
                      <tr key={index}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {item.productName || item.product?.name || t('common.unknownProduct')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {item.quantity}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white text-right">
                          ${item.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="flex justify-end">
                <div className="w-64">
                  <div className="flex justify-between py-2 border-b border-gray-200 dark:border-slate-700">
                    <span className="text-sm text-gray-600 dark:text-gray-300">{t('sales.orders.subtotal')}:</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      ${invoiceData.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-200 dark:border-slate-700">
                    <span className="text-sm text-gray-600 dark:text-gray-300">{t('sales.orders.tax')}:</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      ${invoiceData.tax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between py-4">
                    <span className="text-lg font-bold text-gray-900 dark:text-white">{t('common.total')}:</span>
                    <span className="text-lg font-bold text-gray-900 dark:text-white">
                      ${invoiceData.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {invoiceData.notes && (
                <div className="mt-8 pt-4 border-t border-gray-200 dark:border-slate-700">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('common.notes')}:</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">{invoiceData.notes}</p>
                </div>
              )}

              {/* Footer */}
              <div className="mt-8 pt-4 border-t border-gray-200 dark:border-slate-700 text-center text-xs text-gray-500 dark:text-gray-400">
                <p>{t('sales.orders.thankYou')}</p>
                <p className="mt-2">{t('common.systemName')}</p>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default PurchasingOrders;
