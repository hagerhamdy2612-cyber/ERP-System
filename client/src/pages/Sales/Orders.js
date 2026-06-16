import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import Card from '../../components/Card';
import { Plus, ShoppingCart, CheckCircle, Package, Trash2, FileText, Printer, X, Pencil } from 'lucide-react';

const SalesOrders = () => {
  const { t } = useTranslation();
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showInvoice, setShowInvoice] = useState(false);
  const [invoiceData, setInvoiceData] = useState(null);
  const [loadingInvoice, setLoadingInvoice] = useState(false);
  const [formData, setFormData] = useState({
    customer: '',
    items: [{ product: '', quantity: '' }],
    deliveryDate: '',
    notes: ''
  });

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
    setFormData({
      customer: '',
      items: [{ product: '', quantity: '' }],
      deliveryDate: '',
      notes: ''
    });
  };

  const openCreateModal = () => {
    setEditingId(null);
    setFormData({
      customer: '',
      items: [{ product: '', quantity: '' }],
      deliveryDate: '',
      notes: ''
    });
    setShowModal(true);
  };

  const openEditModal = (order) => {
    const items =
      order.items?.length > 0
        ? order.items.map((item) => ({
            product: item.product?._id || item.product || '',
            quantity: String(item.quantity ?? '')
          }))
        : [{ product: '', quantity: '' }];
    let deliveryStr = '';
    if (order.deliveryDate) {
      const d = new Date(order.deliveryDate);
      if (!Number.isNaN(d.getTime())) {
        deliveryStr = d.toISOString().slice(0, 10);
      }
    }
    setEditingId(order._id);
    setFormData({
      customer: order.customer?._id || order.customer || '',
      items,
      deliveryDate: deliveryStr,
      notes: order.notes || ''
    });
    setShowModal(true);
  };

  useEffect(() => {
    fetchOrders();
    fetchCustomers();
    fetchProducts();
  }, []);

  const fetchOrders = async () => {
    try {
      const response = await axios.get('/api/sales/orders');
      setOrders(response.data.data);
    } catch (error) {
      toast.error(t('sales.errors.fetchFailed'));
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const response = await axios.get('/api/crm/customers');
      setCustomers(response.data.data);
    } catch (error) {
      console.error('Failed to fetch customers');
    }
  };

  const fetchProducts = async () => {
    try {
      const response = await axios.get('/api/inventory/products');
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
          .filter(item => item.product && item.quantity)
          .map(item => ({ product: item.product, quantity: Number(item.quantity) })),
        deliveryDate: formData.deliveryDate ? new Date(formData.deliveryDate).toISOString() : null
      };

      if (submitData.items.length === 0) {
        toast.error(t('sales.errors.addItemRequired'));
        return;
      }

      if (editingId) {
        await axios.put(`/api/sales/orders/${editingId}`, submitData);
        toast.success(t('sales.messages.orderUpdated'));
      } else {
        await axios.post('/api/sales/orders', submitData);
        toast.success(t('sales.messages.orderCreated'));
      }
      closeModal();
      fetchOrders();
    } catch (error) {
      console.error('Create sales order error:', error);
      console.error('Error response:', error.response?.data);
      const errorMessage =
        error.response?.data?.message ||
        error.response?.data?.error ||
        (editingId ? t('sales.errors.updateFailed') : t('sales.errors.createFailed'));
      toast.error(errorMessage);
    }
  };

  const handleConfirm = async (id) => {
    try {
      await axios.put(`/api/sales/orders/${id}/confirm`);
      toast.success(t('sales.messages.orderConfirmed'));
      fetchOrders();
    } catch (error) {
      toast.error(error.response?.data?.message || t('sales.errors.confirmFailed'));
    }
  };

  const handleDeliver = async (id) => {
    try {
      await axios.put(`/api/sales/orders/${id}/deliver`);
      toast.success(t('sales.messages.orderDelivered'));
      fetchOrders();
    } catch (error) {
      toast.error(error.response?.data?.message || t('sales.errors.deliverFailed'));
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this sales order?')) {
      try {
        await axios.delete(`/api/sales/orders/${id}`);
        toast.success(t('sales.messages.orderDeleted'));
        fetchOrders();
      } catch (error) {
        toast.error(error.response?.data?.message || t('sales.errors.deleteFailed'));
      }
    }
  };

  const handleViewInvoice = async (orderId) => {
    setLoadingInvoice(true);
    try {
      const response = await axios.get(`/api/sales/invoices/${orderId}`);
      setInvoiceData(response.data.data);
      setShowInvoice(true);
    } catch (error) {
      toast.error(error.response?.data?.message || t('sales.errors.invoiceLoadFailed'));
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

  // Get selling price from product (inventory) for display
  const getProductPrice = (productId) => {
    const p = products.find(x => x._id === productId);
    if (!p) return 0;
    return (p.sellingPrice != null && p.sellingPrice > 0) ? p.sellingPrice : (p.unitCost || 0);
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
      case 'delivered': return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'confirmed': return <Package className="h-5 w-5 text-yellow-500" />;
      case 'in-production': return <Package className="h-5 w-5 text-orange-500" />;
      case 'pending': return <ShoppingCart className="h-5 w-5 text-gray-500" />;
      default: return <ShoppingCart className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'delivered': return 'bg-green-100 text-green-800';
      case 'confirmed': return 'bg-yellow-100 text-yellow-800';
      case 'in-production': return 'bg-orange-100 text-orange-800';
      case 'pending': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('sales.orders.title')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t('sales.orders.description')}
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600 transition-colors"
        >
          <Plus className="h-4 w-4 mr-2" />
          {t('sales.orders.newOrder')}
        </button>
      </div>

      {/* Sales Orders */}
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
                        {order.customer?.name || t('sales.orders.unknownCustomer')}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center text-sm text-gray-500 dark:text-gray-400">
                      <span>{t('common.total')}: ${order.total.toLocaleString()}</span>
                      <span className="mx-2">•</span>
                      <span>{t('sales.orders.items')}: {order.items.length}</span>
                      <span className="mx-2">•</span>
                      <span>{t('common.date')}: {new Date(order.orderDate).toLocaleDateString()}</span>
                      {order.deliveryDate && (
                        <>
                          <span className="mx-2">•</span>
                          <span>{t('sales.orders.delivery')}: {new Date(order.deliveryDate).toLocaleDateString()}</span>
                        </>
                      )}
                    </div>
                    <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      <span className="font-medium">{t('sales.orders.items')}:</span> {order.items.map(item => 
                        `${item.product?.name || t('common.unknownProduct')} (${item.quantity})`
                      ).join(', ')}
                    </div>
                    {order.notes && (
                      <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        <span className="font-medium">{t('common.notes')}:</span> {order.notes}
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
                    {t(`sales.reports.status.${order.status}`, { defaultValue: order.status })}
                  </span>
                  {order.status === 'pending' && (
                    <button
                      type="button"
                      onClick={() => openEditModal(order)}
                      className="inline-flex items-center px-3 py-1 border border-gray-300 dark:border-slate-600 text-xs font-medium rounded text-gray-700 dark:text-gray-200 bg-white dark:bg-slate-700 hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors"
                    >
                      <Pencil className="h-3 w-3 mr-1" />
                      {t('common.edit')}
                    </button>
                  )}
                  {(order.status === 'pending' || order.status === 'in-production') && (
                    <button
                      onClick={() => handleConfirm(order._id)}
                      className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-white bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 transition-colors"
                    >
                      <CheckCircle className="h-3 w-3 mr-1" />
                      {t('common.confirm')}
                    </button>
                  )}
                  {order.status === 'confirmed' && (
                    <button
                      onClick={() => handleDeliver(order._id)}
                      className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-white bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 transition-colors"
                    >
                      <CheckCircle className="h-3 w-3 mr-1" />
                      {t('sales.actions.deliver', { defaultValue: 'Deliver' })}
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
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 dark:bg-black dark:bg-opacity-70 overflow-y-auto h-full w-full z-50 flex items-start justify-center p-4">
          <div className="relative top-10 mx-auto p-6 border border-gray-200 dark:border-slate-700 w-full max-w-2xl shadow-lg rounded-lg bg-white dark:bg-slate-800 transition-colors duration-300">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                {editingId ? t('sales.orders.editOrder') : t('sales.orders.createOrder')}
              </h3>
              <button
                type="button"
                onClick={closeModal}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-500 dark:hover:text-gray-300 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('common.customers')}
                </label>
                <select
                  required
                  value={formData.customer}
                  onChange={(e) => setFormData({ ...formData, customer: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 dark:border-slate-600 rounded-md shadow-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-primary-500 focus:border-primary-500 transition-colors"
                >
                  <option value="">{t('sales.orders.selectCustomer')}</option>
                  {customers.map(customer => (
                    <option key={customer._id} value={customer._id}>
                      {customer?.name || t('sales.orders.unknownCustomer')}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('sales.orders.items')}
                </label>
                {formData.items.map((item, index) => (
                  <div key={index} className="flex flex-wrap items-center gap-3 mb-3 p-2 rounded-md bg-gray-50 dark:bg-slate-700/40">
                    <select
                      value={item.product}
                      onChange={(e) => updateItem(index, 'product', e.target.value)}
                      className="min-w-[180px] flex-1 border border-gray-300 dark:border-slate-600 rounded-md shadow-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-primary-500 focus:border-primary-500 transition-colors"
                    >
                      <option value="">{t('sales.orders.selectProduct')}</option>
                      {products.filter(p => p.category === 'final-product' || p.category === 'finished-good').map(product => (
                        <option key={product._id} value={product._id}>
                          {product?.name || t('common.unknownProduct')} (${(product.sellingPrice != null && product.sellingPrice > 0 ? product.sellingPrice : product.unitCost || 0).toLocaleString()})
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="1"
                      placeholder={t('sales.orders.qty')}
                      value={item.quantity}
                      onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                      className="w-20 border border-gray-300 dark:border-slate-600 rounded-md shadow-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-primary-500 focus:border-primary-500 transition-colors"
                    />
                    <span className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap min-w-[140px]">
                      Price: ${getProductPrice(item.product).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      {item.product && item.quantity && (
                        <span className="ml-1 font-medium text-gray-900 dark:text-white">
                          = ${(getProductPrice(item.product) * Number(item.quantity)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      )}
                    </span>
                    {formData.items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="p-1.5 rounded text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        title={t('common.removeItem')}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addItem}
                  className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300 transition-colors"
                >
                  + {t('sales.orders.addItem')}
                </button>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('sales.orders.deliveryDate')}
                </label>
                <input
                  type="date"
                  value={formData.deliveryDate}
                  onChange={(e) => setFormData({ ...formData, deliveryDate: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 dark:border-slate-600 rounded-md shadow-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-primary-500 focus:border-primary-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('common.notes')}
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
                  onClick={closeModal}
                  className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-700 hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600 transition-colors"
                >
                  {editingId ? t('sales.orders.updateOrder') : t('sales.orders.createOrder')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invoice Modal */}
      {showInvoice && invoiceData && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 dark:bg-black dark:bg-opacity-70 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border border-gray-200 dark:border-slate-700 w-full max-w-4xl shadow-lg rounded-md bg-white dark:bg-slate-800 print:shadow-none print:bg-white transition-colors duration-300">
            <div className="mb-4 flex justify-between items-center print:hidden">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">{t('sales.orders.salesInvoice')}</h3>
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
            <div className="bg-white dark:bg-slate-800 print:bg-white p-8 print:p-4">
              {/* Header */}
              <div className="mb-8 border-b-2 border-gray-300 dark:border-slate-700 print:border-gray-300 pb-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white print:text-gray-900 mb-2">{t('common.brandName')}</h1>
                    <p className="text-gray-600 dark:text-gray-400 print:text-gray-600">{t('sales.orders.salesInvoice')}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600 dark:text-gray-400 print:text-gray-600">{t('sales.orders.invoiceNo')}: <span className="font-semibold">{invoiceData.invoiceNumber}</span></p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 print:text-gray-600">{t('sales.orders.orderNo')}: <span className="font-semibold">{invoiceData.salesOrder?.orderNumber || t('common.unknown')}</span></p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 print:text-gray-600">{t('common.date')}: <span className="font-semibold">{new Date(invoiceData.invoiceDate).toLocaleDateString()}</span></p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 print:text-gray-600">{t('sales.orders.dueDate')}: <span className="font-semibold">{new Date(invoiceData.dueDate).toLocaleDateString()}</span></p>
                  </div>
                </div>
              </div>

              {/* Bill To */}
              <div className="mb-8 grid grid-cols-2 gap-8">
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 print:text-gray-700 mb-2">{t('sales.orders.billTo')}:</h3>
                  <p className="text-sm text-gray-900 dark:text-white print:text-gray-900 font-medium">{invoiceData.customer?.name || 'N/A'}</p>
                  {invoiceData.customer?.company && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 print:text-gray-600">{invoiceData.customer.company}</p>
                  )}
                  {invoiceData.customer?.address && (
                    <div className="text-sm text-gray-600 dark:text-gray-400 print:text-gray-600 mt-1">
                      {invoiceData.customer.address.street && <p>{invoiceData.customer.address.street}</p>}
                      {invoiceData.customer.address.city && (
                        <p>
                          {invoiceData.customer.address.city}
                          {invoiceData.customer.address.state && `, ${invoiceData.customer.address.state}`}
                          {invoiceData.customer.address.zipCode && ` ${invoiceData.customer.address.zipCode}`}
                        </p>
                      )}
                      {invoiceData.customer.address.country && <p>{invoiceData.customer.address.country}</p>}
                    </div>
                  )}
                  {invoiceData.customer?.email && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 print:text-gray-600 mt-1">{invoiceData.customer.email}</p>
                  )}
                  {invoiceData.customer?.phone && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 print:text-gray-600">{invoiceData.customer.phone}</p>
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 print:text-gray-700 mb-2">{t('sales.orders.paymentTerms')}:</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 print:text-gray-600">{invoiceData.paymentTerms || 'Net 30'}</p>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 print:text-gray-700 mb-2 mt-4">{t('common.status')}:</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 print:text-gray-600 capitalize">{invoiceData.status}</p>
                </div>
              </div>

              {/* Items Table */}
              <div className="mb-8">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700 print:divide-gray-200">
                  <thead className="bg-gray-50 dark:bg-slate-700 print:bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 print:text-gray-500 uppercase tracking-wider">{t('sales.orders.item')}</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 print:text-gray-500 uppercase tracking-wider">{t('sales.orders.quantity')}</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 print:text-gray-500 uppercase tracking-wider">{t('sales.orders.unitPrice')}</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 print:text-gray-500 uppercase tracking-wider">{t('common.total')}</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-slate-800 print:bg-white divide-y divide-gray-200 dark:divide-slate-700 print:divide-gray-200">
                    {invoiceData.items.map((item, index) => (
                      <tr key={index}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white print:text-gray-900">
                          {item.productName || item.product?.name || t('common.unknownProduct')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 print:text-gray-500">
                          {item.quantity}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 print:text-gray-500">
                          ${item.unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white print:text-gray-900 text-right">
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
                  <div className="flex justify-between py-2 border-b border-gray-200 dark:border-slate-700 print:border-gray-200">
                    <span className="text-sm text-gray-600 dark:text-gray-400 print:text-gray-600">{t('sales.orders.subtotal')}:</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white print:text-gray-900">
                      ${invoiceData.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-200 dark:border-slate-700 print:border-gray-200">
                    <span className="text-sm text-gray-600 dark:text-gray-400 print:text-gray-600">{t('sales.orders.tax')}:</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white print:text-gray-900">
                      ${invoiceData.tax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between py-4">
                    <span className="text-lg font-bold text-gray-900 dark:text-white print:text-gray-900">{t('common.total')}:</span>
                    <span className="text-lg font-bold text-gray-900 dark:text-white print:text-gray-900">
                      ${invoiceData.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {invoiceData.notes && (
                <div className="mt-8 pt-4 border-t border-gray-200 dark:border-slate-700 print:border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 print:text-gray-700 mb-2">{t('common.notes')}:</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 print:text-gray-600">{invoiceData.notes}</p>
                </div>
              )}

              {/* Footer */}
              <div className="mt-8 pt-4 border-t border-gray-200 dark:border-slate-700 print:border-gray-200 text-center text-xs text-gray-500 dark:text-gray-400 print:text-gray-500">
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

export default SalesOrders;
