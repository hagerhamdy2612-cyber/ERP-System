import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Plus, Package, AlertTriangle, Edit, Trash2, Layers } from 'lucide-react';

const FinishedProducts = () => {
  const [products, setProducts] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    description: '',
    unit: '',
    currentStock: '',
    minStockLevel: '',
    maxStockLevel: '',
    unitCost: '',
    sellingPrice: '',
    requiredMaterials: [{ product: '', quantity: '' }]
  });

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchRawMaterials = async () => {
    try {
      const response = await axios.get('/api/inventory/products');
      const all = response.data.data || [];
      setRawMaterials(all.filter(p => p.category === 'raw-material' || p.category === 'others'));
    } catch (err) {
      console.error('Failed to fetch raw materials', err);
    }
  };

  const fetchProducts = async () => {
    try {
      const response = await axios.get('/api/inventory/products?category=final-product');
      setProducts(response.data.data || []);
      console.log('✅ Final Products fetched:', response.data.data?.length || 0);
    } catch (error) {
      console.error('❌ Failed to fetch final products:', error);
      toast.error(error.response?.data?.message || 'Failed to fetch final products');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        requiredMaterials: (formData.requiredMaterials || [])
          .filter(rm => rm.product && rm.quantity)
          .map(rm => ({ product: rm.product, quantity: Number(rm.quantity) }))
      };
      if (editingProduct) {
        await axios.put(`/api/inventory/products/${editingProduct._id}`, payload);
        toast.success('Finished product updated successfully');
      } else {
        await axios.post('/api/inventory/products', {
          ...payload,
          category: 'final-product'
        });
        toast.success('Finished product created successfully');
      }
      setShowModal(false);
      setEditingProduct(null);
      setFormData({
        name: '',
        sku: '',
        description: '',
        unit: '',
        currentStock: '',
        minStockLevel: '',
        maxStockLevel: '',
        unitCost: '',
        sellingPrice: '',
        requiredMaterials: [{ product: '', quantity: '' }]
      });
      fetchProducts();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save finished product');
    }
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    const rms = product.requiredMaterials && product.requiredMaterials.length > 0
      ? product.requiredMaterials.map(rm => ({
          product: rm.product?._id || rm.product || '',
          quantity: rm.quantity ?? ''
        }))
      : [{ product: '', quantity: '' }];
    setFormData({
      name: product.name,
      sku: product.sku,
      description: product.description || '',
      unit: product.unit,
      currentStock: product.currentStock,
      minStockLevel: product.minStockLevel,
      maxStockLevel: product.maxStockLevel,
      unitCost: product.unitCost,
      sellingPrice: product.sellingPrice || '',
      requiredMaterials: rms
    });
    fetchRawMaterials();
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this finished product?')) {
      try {
        await axios.delete(`/api/inventory/products/${id}`);
        toast.success('Finished product deleted successfully');
        fetchProducts();
      } catch (error) {
        console.error('Delete error:', error);
        toast.error(error.response?.data?.message || 'Failed to delete finished product');
      }
    }
  };

  const isLowStock = (product) => {
    return product.currentStock <= product.minStockLevel;
  };

  const getStockStatus = (product) => {
    if (product.currentStock === 0) return { color: 'text-red-600', bg: 'bg-red-100', text: 'Out of Stock' };
    if (isLowStock(product)) return { color: 'text-yellow-600', bg: 'bg-yellow-100', text: 'Low Stock' };
    return { color: 'text-green-600', bg: 'bg-green-100', text: 'In Stock' };
  };

  const calculateProfitMargin = (product) => {
    if (!product.sellingPrice || !product.unitCost) return 0;
    return ((product.sellingPrice - product.unitCost) / product.sellingPrice * 100).toFixed(1);
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
          <h1 className="text-2xl font-bold text-gray-900">Final Products</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage final products inventory and pricing
          </p>
        </div>
        <button
          onClick={() => {
            setShowModal(true);
            setFormData({
              name: '',
              sku: '',
              description: '',
              unit: '',
              currentStock: '',
              minStockLevel: '',
              maxStockLevel: '',
              unitCost: '',
              sellingPrice: '',
              requiredMaterials: [{ product: '', quantity: '' }]
            });
            fetchRawMaterials();
          }}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Final Product
        </button>
      </div>

      {/* Low Stock Alert */}
      {products.filter(isLowStock).length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <div className="flex">
            <AlertTriangle className="h-5 w-5 text-yellow-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">
                Low Stock Alert
              </h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>{products.filter(isLowStock).length} finished product(s) are running low on stock.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Products Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => {
          const stockStatus = getStockStatus(product);
          const profitMargin = calculateProfitMargin(product);
          return (
            <div key={product._id} className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <Package className="h-8 w-8 text-gray-400" />
                    </div>
                    <div className="ml-4">
                      <h3 className="text-lg font-medium text-gray-900">{product.name}</h3>
                      <p className="text-sm text-gray-500">{product.sku}</p>
                    </div>
                  </div>
                  {isLowStock(product) && (
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                  )}
                </div>
                
                <div className="mt-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Current Stock</span>
                    <span className={`font-medium ${stockStatus.color}`}>
                      {product.currentStock} {product.unit}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-gray-500">Min Level</span>
                    <span className="text-gray-900">{product.minStockLevel} {product.unit}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-gray-500">Unit Cost</span>
                    <span className="text-gray-900">${product.unitCost}</span>
                  </div>
                  {product.sellingPrice && (
                    <div className="mt-2 flex items-center justify-between text-sm">
                      <span className="text-gray-500">Selling Price</span>
                      <span className="text-gray-900">${product.sellingPrice}</span>
                    </div>
                  )}
                  {product.sellingPrice && (
                    <div className="mt-2 flex items-center justify-between text-sm">
                      <span className="text-gray-500">Profit Margin</span>
                      <span className={`font-medium ${profitMargin > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {profitMargin}%
                      </span>
                    </div>
                  )}
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-gray-500">Total Value</span>
                    <span className="text-gray-900">${(product.currentStock * product.unitCost).toLocaleString()}</span>
                  </div>
                  {product.requiredMaterials && product.requiredMaterials.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <p className="text-xs font-medium text-gray-500 flex items-center gap-1">
                        <Layers className="h-3.5 w-3.5" />
                        Required raw materials
                      </p>
                      <ul className="mt-1.5 space-y-1">
                        {product.requiredMaterials.map((rm, idx) => (
                          <li key={idx} className="text-xs text-gray-600 flex justify-between">
                            <span>{rm.product?.name || '—'}</span>
                            <span className="font-medium">{rm.quantity} {rm.product?.unit || ''}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${stockStatus.bg} ${stockStatus.color}`}>
                    {stockStatus.text}
                  </span>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleEdit(product)}
                      className="text-primary-600 hover:text-primary-900"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(product._id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {editingProduct ? 'Edit Final Product' : 'Add Final Product'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Product Name
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    SKU
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Unit
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Current Stock
                    </label>
                    <input
                      type="number"
                      required
                      value={formData.currentStock}
                      onChange={(e) => setFormData({ ...formData, currentStock: e.target.value })}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Unit Cost
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formData.unitCost}
                      onChange={(e) => setFormData({ ...formData, unitCost: e.target.value })}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Min Stock Level
                    </label>
                    <input
                      type="number"
                      required
                      value={formData.minStockLevel}
                      onChange={(e) => setFormData({ ...formData, minStockLevel: e.target.value })}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Max Stock Level
                    </label>
                    <input
                      type="number"
                      required
                      value={formData.maxStockLevel}
                      onChange={(e) => setFormData({ ...formData, maxStockLevel: e.target.value })}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Selling Price
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.sellingPrice}
                    onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Required Raw Materials (from Inventory)
                  </label>
                  <p className="text-xs text-gray-500 mb-2">
                    Choose raw materials needed to make this final product. Used when creating production orders in Manufacturing.
                  </p>
                  {(formData.requiredMaterials || [{ product: '', quantity: '' }]).map((rm, index) => (
                    <div key={index} className="flex gap-2 items-center mb-2">
                      <select
                        value={rm.product}
                        onChange={(e) => {
                          const next = [...(formData.requiredMaterials || [])];
                          next[index] = { ...next[index], product: e.target.value };
                          setFormData({ ...formData, requiredMaterials: next });
                        }}
                        className="flex-1 border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                      >
                        <option value="">Select raw material</option>
                        {rawMaterials.map(p => (
                          <option key={p._id} value={p._id}>{p.name} ({p.sku})</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min="1"
                        placeholder="Qty"
                        value={rm.quantity}
                        onChange={(e) => {
                          const next = [...(formData.requiredMaterials || [])];
                          next[index] = { ...next[index], quantity: e.target.value };
                          setFormData({ ...formData, requiredMaterials: next });
                        }}
                        className="w-24 border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                      />
                      {(formData.requiredMaterials?.length || 1) > 1 && (
                        <button
                          type="button"
                          onClick={() => setFormData({
                            ...formData,
                            requiredMaterials: formData.requiredMaterials.filter((_, i) => i !== index)
                          })}
                          className="text-red-600 hover:text-red-800"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setFormData({
                      ...formData,
                      requiredMaterials: [...(formData.requiredMaterials || []), { product: '', quantity: '' }]
                    })}
                    className="text-sm text-primary-600 hover:text-primary-800"
                  >
                    + Add raw material
                  </button>
                </div>
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setEditingProduct(null);
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
                  >
                    {editingProduct ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinishedProducts;
