import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { Plus, Package, AlertTriangle, Edit, Trash2, Layers } from 'lucide-react';
import ProductSearchBar from '../../components/Inventory/ProductSearchBar';
import { filterInventoryBySearch } from '../../utils/inventorySearch';

const FinishedProducts = () => {
  const { t } = useTranslation();
  const [products, setProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
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
      setRawMaterials(all.filter((p) => p.category === 'raw-material'));
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
      toast.error(error.response?.data?.message || t('inventory.finishedProducts.errors.fetchFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const cleanedMaterials = (formData.requiredMaterials || [])
        .filter(rm => rm.product && rm.quantity !== '' && rm.quantity != null)
        .map(rm => ({ product: rm.product, quantity: Number(rm.quantity) }))
        .filter(rm => Number.isFinite(rm.quantity) && rm.quantity > 0);

      const invalidRow = (formData.requiredMaterials || []).find(
        (rm) => rm.product && rm.quantity !== '' && rm.quantity != null && !(Number(rm.quantity) > 0)
      );
      if (invalidRow) {
        toast.error(t('inventory.finishedProducts.errors.invalidMaterialQuantity'));
        return;
      }

      // Final product unit cost is derived from its bill of materials (raw material costs).
      const derivedUnitCost = cleanedMaterials.reduce((sum, rm) => {
        const material = rawMaterials.find((m) => m._id === rm.product);
        return sum + rm.quantity * (material?.unitCost || 0);
      }, 0);
      const payload = {
        ...formData,
        unitCost: Number(derivedUnitCost.toFixed(2)),
        requiredMaterials: cleanedMaterials
      };
      if (editingProduct) {
        await axios.put(`/api/inventory/products/${editingProduct._id}`, payload);
        toast.success(t('inventory.finishedProducts.messages.updated'));
      } else {
        await axios.post('/api/inventory/products', {
          ...payload,
          category: 'final-product'
        });
        toast.success(t('inventory.finishedProducts.messages.created'));
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
      toast.error(error.response?.data?.message || t('inventory.finishedProducts.errors.saveFailed'));
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
    if (window.confirm(t('inventory.finishedProducts.deleteConfirm'))) {
      try {
        await axios.delete(`/api/inventory/products/${id}`);
        toast.success(t('inventory.finishedProducts.messages.deleted'));
        fetchProducts();
      } catch (error) {
        console.error('Delete error:', error);
        toast.error(error.response?.data?.message || t('inventory.finishedProducts.errors.deleteFailed'));
      }
    }
  };

  const isLowStock = (product) => {
    return product.currentStock <= product.minStockLevel;
  };

  const getStockStatus = (product) => {
    if (product.currentStock === 0) return { color: 'text-red-600', bg: 'bg-red-100', text: t('inventory.status.outOfStock') };
    if (isLowStock(product)) return { color: 'text-yellow-600', bg: 'bg-yellow-100', text: t('inventory.status.lowStock') };
    return { color: 'text-green-600', bg: 'bg-green-100', text: t('inventory.status.inStock') };
  };

  const filteredProducts = useMemo(
    () => filterInventoryBySearch(products, searchQuery),
    [products, searchQuery]
  );

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
          <h1 className="text-2xl font-bold text-gray-900">{t('inventory.finishedProducts.title')}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {t('inventory.finishedProducts.description')}
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
          {t('inventory.finishedProducts.add')}
        </button>
      </div>

      <ProductSearchBar value={searchQuery} onChange={setSearchQuery} />

      {/* Low Stock Alert */}
      {products.filter(isLowStock).length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <div className="flex">
            <AlertTriangle className="h-5 w-5 text-yellow-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">
                {t('inventory.finishedProducts.lowStockAlert')}
              </h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>{t('inventory.finishedProducts.lowStockMessage', { count: products.filter(isLowStock).length })}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Products Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {filteredProducts.map((product) => {
          const stockStatus = getStockStatus(product);
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
                    <span className="text-gray-500">{t('inventory.finishedProducts.currentStock')}</span>
                    <span className={`font-medium ${stockStatus.color}`}>
                      {product.currentStock} {product.unit}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-gray-500">{t('inventory.finishedProducts.minLevel')}</span>
                    <span className="text-gray-900">{product.minStockLevel} {product.unit}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-gray-500">{t('inventory.finishedProducts.sellingPrice')}</span>
                    <span className="text-gray-900">
                      {product.sellingPrice != null && product.sellingPrice > 0
                        ? `$${product.sellingPrice}`
                        : '—'}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-gray-500">{t('inventory.finishedProducts.totalValue')}</span>
                    <span className="text-gray-900">
                      ${((product.currentStock || 0) * (product.sellingPrice || 0)).toLocaleString()}
                    </span>
                  </div>
                  {product.requiredMaterials && product.requiredMaterials.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <p className="text-xs font-medium text-gray-500 flex items-center gap-1">
                        <Layers className="h-3.5 w-3.5" />
                        {t('inventory.finishedProducts.requiredRawMaterials')}
                      </p>
                      <ul className="mt-1.5 space-y-1">
                        {product.requiredMaterials.map((rm, idx) => (
                          <li key={idx} className="text-xs text-gray-600 flex justify-between">
                            <span>{rm.product?.name || t('common.unknown')}</span>
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

      {products.length > 0 && filteredProducts.length === 0 && (
        <p className="text-center text-gray-500 py-12">{t('inventory.products.noSearchResults')}</p>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {editingProduct ? t('inventory.finishedProducts.edit') : t('inventory.finishedProducts.add')}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    {t('inventory.finishedProducts.productName')}
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
                    {t('inventory.finishedProducts.sku')}
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
                    {t('inventory.finishedProducts.unit')}
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
                      {t('inventory.finishedProducts.currentStock')}
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
                      {t('inventory.finishedProducts.minStockLevel')}
                    </label>
                    <input
                      type="number"
                      required
                      value={formData.minStockLevel}
                      onChange={(e) => setFormData({ ...formData, minStockLevel: e.target.value })}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      {t('inventory.finishedProducts.maxStockLevel')}
                    </label>
                    <input
                      type="number"
                      required
                      value={formData.maxStockLevel}
                      onChange={(e) => setFormData({ ...formData, maxStockLevel: e.target.value })}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      {t('inventory.finishedProducts.sellingPrice')}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.sellingPrice}
                      onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    {t('inventory.finishedProducts.descriptionLabel')}
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('inventory.finishedProducts.requiredRawMaterialsFromInventory')}
                  </label>
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
                        <option value="">{t('inventory.finishedProducts.selectRawMaterial')}</option>
                        {rawMaterials.map(p => (
                          <option key={p._id} value={p._id}>{p.name} ({p.sku})</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        step="any"
                        placeholder={t('inventory.finishedProducts.qtyPlaceholder')}
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
                    {t('inventory.finishedProducts.addRawMaterial')}
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
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
                  >
                    {editingProduct ? t('common.update') : t('common.create')}
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
