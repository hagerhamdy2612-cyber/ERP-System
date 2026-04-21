import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { Plus, Package, AlertTriangle, Edit, Trash2, Truck } from 'lucide-react';

const RawMaterials = () => {
  const { t } = useTranslation();
  const [materials, setMaterials] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    description: '',
    unit: '',
    currentStock: '',
    minStockLevel: '',
    maxStockLevel: '',
    unitCost: '',
    supplier: ''
  });

  useEffect(() => {
    fetchMaterials();
    fetchSuppliers();
  }, []);

  const fetchMaterials = async () => {
    try {
      const response = await axios.get('/api/inventory/products?category=raw-material');
      setMaterials(response.data.data || []);
      console.log('✅ Raw Materials fetched:', response.data.data?.length || 0);
    } catch (error) {
      console.error('❌ Failed to fetch raw materials:', error);
      toast.error(error.response?.data?.message || t('inventory.rawMaterials.errors.fetchFailed'));
    } finally {
      setLoading(false);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const response = await axios.get('/api/scm/suppliers');
      setSuppliers(response.data.data);
    } catch (error) {
      console.error(t('inventory.rawMaterials.errors.fetchSuppliers'));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingMaterial) {
        await axios.put(`/api/inventory/products/${editingMaterial._id}`, formData);
        toast.success(t('inventory.rawMaterials.messages.updated'));
      } else {
        await axios.post('/api/inventory/products', {
          ...formData,
          category: 'raw-material'
        });
        toast.success(t('inventory.rawMaterials.messages.created'));
      }
      setShowModal(false);
      setEditingMaterial(null);
      setFormData({
        name: '',
        sku: '',
        description: '',
        unit: '',
        currentStock: '',
        minStockLevel: '',
        maxStockLevel: '',
        unitCost: '',
        supplier: ''
      });
      fetchMaterials();
    } catch (error) {
      toast.error(error.response?.data?.message || t('inventory.rawMaterials.errors.saveFailed'));
    }
  };

  const handleEdit = (material) => {
    setEditingMaterial(material);
      setFormData({
        name: material.name,
        sku: material.sku,
        description: material.description || '',
        unit: material.unit,
        currentStock: material.currentStock,
        minStockLevel: material.minStockLevel,
        maxStockLevel: material.maxStockLevel,
        unitCost: material.unitCost,
        supplier: material.supplier?._id || ''
      });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm(t('inventory.rawMaterials.deleteConfirm'))) {
      try {
        await axios.delete(`/api/inventory/products/${id}`);
        toast.success(t('inventory.rawMaterials.messages.deleted'));
        fetchMaterials();
      } catch (error) {
        console.error('Delete error:', error);
        toast.error(error.response?.data?.message || t('inventory.rawMaterials.errors.deleteFailed'));
      }
    }
  };

  const isLowStock = (material) => {
    return material.currentStock <= material.minStockLevel;
  };

  const getStockStatus = (material) => {
    if (material.currentStock === 0) return { color: 'text-red-600', bg: 'bg-red-100', text: t('inventory.status.outOfStock') };
    if (isLowStock(material)) return { color: 'text-yellow-600', bg: 'bg-yellow-100', text: t('inventory.status.lowStock') };
    return { color: 'text-green-600', bg: 'bg-green-100', text: t('inventory.status.inStock') };
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
          <h1 className="text-2xl font-bold text-gray-900">{t('inventory.rawMaterials.title')}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {t('inventory.rawMaterials.description')}
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          {t('inventory.rawMaterials.add')}
        </button>
      </div>

      {/* Low Stock Alert */}
      {materials.filter(isLowStock).length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <div className="flex">
            <AlertTriangle className="h-5 w-5 text-yellow-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">
                {t('inventory.rawMaterials.lowStockAlert')}
              </h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>{t('inventory.rawMaterials.lowStockMessage', { count: materials.filter(isLowStock).length })}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Materials Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {materials.map((material) => {
          const stockStatus = getStockStatus(material);
          return (
            <div key={material._id} className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <Package className="h-8 w-8 text-gray-400" />
                    </div>
                    <div className="ml-4">
                      <h3 className="text-lg font-medium text-gray-900">{material.name}</h3>
                      <p className="text-sm text-gray-500">{material.sku}</p>
                    </div>
                  </div>
                  {isLowStock(material) && (
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                  )}
                </div>
                
                <div className="mt-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">{t('inventory.rawMaterials.currentStock')}</span>
                    <span className={`font-medium ${stockStatus.color}`}>
                      {material.currentStock} {material.unit}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-gray-500">{t('inventory.rawMaterials.minLevel')}</span>
                    <span className="text-gray-900">{material.minStockLevel} {material.unit}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-gray-500">{t('inventory.rawMaterials.unitCost')}</span>
                    <span className="text-gray-900">${material.unitCost}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-gray-500">{t('inventory.rawMaterials.totalValue')}</span>
                    <span className="text-gray-900">${(material.currentStock * material.unitCost).toLocaleString()}</span>
                  </div>
                  {material.supplier && (
                    <div className="mt-2 flex items-center text-sm text-gray-500">
                      <Truck className="h-4 w-4 mr-1" />
                      <span>{material.supplier.name}</span>
                    </div>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${stockStatus.bg} ${stockStatus.color}`}>
                    {stockStatus.text}
                  </span>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleEdit(material)}
                      className="text-primary-600 hover:text-primary-900"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(material._id)}
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
                {editingMaterial ? t('inventory.rawMaterials.edit') : t('inventory.rawMaterials.add')}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    {t('inventory.rawMaterials.materialName')}
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
                    {t('inventory.rawMaterials.sku')}
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
                    {t('inventory.rawMaterials.unit')}
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
                      {t('inventory.rawMaterials.currentStock')}
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
                      {t('inventory.rawMaterials.unitCost')}
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
                      {t('inventory.rawMaterials.minStockLevel')}
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
                      {t('inventory.rawMaterials.maxStockLevel')}
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
                    {t('inventory.rawMaterials.supplier')}
                  </label>
                  <select
                    value={formData.supplier}
                    onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="">{t('inventory.rawMaterials.selectSupplier')}</option>
                    {suppliers.map(supplier => (
                      <option key={supplier._id} value={supplier._id}>
                        {supplier.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    {t('inventory.rawMaterials.descriptionLabel')}
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setEditingMaterial(null);
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
                  >
                    {editingMaterial ? t('common.update') : t('common.create')}
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

export default RawMaterials;
