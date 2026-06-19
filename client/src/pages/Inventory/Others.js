import React, { useState, useEffect, useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { Plus, Package, AlertTriangle, Edit, Trash2 } from 'lucide-react';
import ProductSearchBar from '../../components/Inventory/ProductSearchBar';
import { filterInventoryBySearch } from '../../utils/inventorySearch';
import {
  fetchOthersItems,
  createOthersItem,
  updateOthersItem,
  deleteOthersItem,
  getApiErrorMessage
} from '../../api/inventoryOthers';

const EMPTY_FORM = {
  name: '',
  sku: '',
  description: '',
  unit: '',
  currentStock: ''
};

const Others = () => {
  const { t } = useTranslation();
  const [items, setItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);

  const loadItems = useCallback(async () => {
    try {
      const response = await fetchOthersItems();
      setItems(response.data.data || []);
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('inventory.others.errors.fetchFailed')));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const closeModal = () => {
    setShowModal(false);
    setEditingItem(null);
    setFormData(EMPTY_FORM);
  };

  const buildPayload = () => ({
    name: formData.name.trim(),
    sku: formData.sku.trim(),
    description: formData.description,
    unit: formData.unit.trim(),
    currentStock: Number(formData.currentStock) || 0
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = buildPayload();
    try {
      if (editingItem) {
        await updateOthersItem(editingItem._id, payload);
        toast.success(t('inventory.others.messages.updated'));
      } else {
        await createOthersItem(payload);
        toast.success(t('inventory.others.messages.created'));
      }
      closeModal();
      loadItems();
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('inventory.others.errors.saveFailed')));
    }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      sku: item.sku,
      description: item.description || '',
      unit: item.unit,
      currentStock: item.currentStock
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t('inventory.others.deleteConfirm'))) return;
    try {
      await deleteOthersItem(id);
      toast.success(t('inventory.others.messages.deleted'));
      loadItems();
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('inventory.others.errors.deleteFailed')));
    }
  };

  const getStockStatus = (item) => {
    if (item.currentStock === 0) {
      return { color: 'text-red-600', bg: 'bg-red-100', text: t('inventory.status.outOfStock') };
    }
    return { color: 'text-green-600', bg: 'bg-green-100', text: t('inventory.status.inStock') };
  };

  const filteredItems = useMemo(
    () => filterInventoryBySearch(items, searchQuery),
    [items, searchQuery]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('inventory.others.title')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('inventory.others.description')}</p>
        </div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md shadow-sm hover:bg-primary-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          {t('inventory.others.add')}
        </button>
      </div>

      <ProductSearchBar value={searchQuery} onChange={setSearchQuery} />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {filteredItems.map((item) => {
          const stockStatus = getStockStatus(item);
          return (
            <div key={item._id} className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Package className="h-8 w-8 text-gray-400" />
                    <div className="ml-4">
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white">{item.name}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{item.sku}</p>
                    </div>
                  </div>
                  {item.currentStock === 0 && <AlertTriangle className="h-5 w-5 text-red-500" />}
                </div>

                <div className="mt-4 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 dark:text-gray-400">{t('inventory.others.currentStock')}</span>
                    <span className={`font-medium ${stockStatus.color}`}>
                      {item.currentStock} {item.unit}
                    </span>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${stockStatus.bg} ${stockStatus.color}`}>
                    {stockStatus.text}
                  </span>
                  <div className="flex items-center space-x-2">
                    <button type="button" onClick={() => handleEdit(item)} className="text-primary-600 hover:text-primary-900">
                      <Edit className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => handleDelete(item._id)} className="text-red-600 hover:text-red-900">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {items.length === 0 && (
        <p className="text-center text-gray-500 dark:text-gray-400 py-12">{t('inventory.others.noItems')}</p>
      )}

      {items.length > 0 && filteredItems.length === 0 && (
        <p className="text-center text-gray-500 dark:text-gray-400 py-12">{t('inventory.products.noSearchResults')}</p>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white dark:bg-gray-800 dark:border-gray-700">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                {editingItem ? t('inventory.others.edit') : t('inventory.others.add')}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('inventory.others.itemName')}</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('inventory.others.sku')}</label>
                <input
                  type="text"
                  required
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('inventory.others.unit')}</label>
                <input
                  type="text"
                  required
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('inventory.others.currentStock')}</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={formData.currentStock}
                  onChange={(e) => setFormData({ ...formData, currentStock: e.target.value })}
                  className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('inventory.others.descriptionLabel')}</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
                >
                  {editingItem ? t('common.update') : t('common.create')}
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

export default Others;
