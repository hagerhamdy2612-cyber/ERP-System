import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import * as archiveApi from '../../services/archiveService';
import Card from '../../components/Card';
import { Archive, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';

const MODULES = ['Sales', 'Purchasing', 'Inventory', 'HR', 'Production', 'CRM'];

const ArchivePage = () => {
  const { user } = useAuth();
  const [archives, setArchives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [filters, setFilters] = useState({
    module: '',
    startDate: '',
    endDate: '',
    documentNumber: ''
  });
  const [appliedFilters, setAppliedFilters] = useState({ module: '', startDate: '', endDate: '', documentNumber: '' });
  const [restoreId, setRestoreId] = useState(null);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const limit = 20;

  const fetchArchives = useCallback(async () => {
    if (user?.role !== 'admin') return;
    setLoading(true);
    try {
      const params = { page, limit };
      if (appliedFilters.module) params.module = appliedFilters.module;
      if (appliedFilters.startDate) params.startDate = appliedFilters.startDate;
      if (appliedFilters.endDate) params.endDate = appliedFilters.endDate;
      if (appliedFilters.documentNumber) params.documentNumber = appliedFilters.documentNumber;
      const result = await archiveApi.getArchives(params);
      setArchives(result.data);
      setTotal(result.total);
      setPages(result.pages);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load archive');
      setArchives([]);
      setTotal(0);
      setPages(0);
    } finally {
      setLoading(false);
    }
  }, [user?.role, page, appliedFilters.module, appliedFilters.startDate, appliedFilters.endDate, appliedFilters.documentNumber]);

  useEffect(() => {
    fetchArchives();
  }, [fetchArchives]);

  const handleApplyFilters = () => {
    setAppliedFilters({ ...filters });
    setPage(1);
  };

  const handleRestoreClick = (id) => {
    setRestoreId(id);
    setShowRestoreModal(true);
  };

  const confirmRestore = async () => {
    if (!restoreId) return;
    setActionLoading(true);
    try {
      await archiveApi.restoreArchive(restoreId);
      toast.success('Document restored successfully');
      setShowRestoreModal(false);
      setRestoreId(null);
      fetchArchives();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Restore failed');
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (d) => (d ? new Date(d).toLocaleString() : '—');

  if (user?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <p className="text-lg font-medium text-gray-900 dark:text-gray-100">Access Denied</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Only administrators can access the archive.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Archive className="h-7 w-7 text-primary-600 dark:text-primary-400" />
          Archive
        </h1>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Module</label>
            <select
              name="module"
              value={filters.module}
              onChange={(e) => setFilters((f) => ({ ...f, module: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100"
            >
              <option value="">All modules</option>
              {MODULES.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start date</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters((f) => ({ ...f, startDate: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End date</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters((f) => ({ ...f, endDate: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Document number</label>
            <input
              type="text"
              placeholder="Search..."
              value={filters.documentNumber}
              onChange={(e) => setFilters((f) => ({ ...f, documentNumber: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div className="flex justify-end lg:justify-start">
            <button
              type="button"
              onClick={handleApplyFilters}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-md font-medium"
            >
              Apply
            </button>
          </div>
        </div>
      </Card>

      <Card padding={false} className="overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex justify-center py-12 text-gray-500 dark:text-gray-400">Loading archive...</div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
              <thead className="bg-gray-50 dark:bg-slate-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Module</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Document Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Document Number</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Deleted By</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Deleted At</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Reason</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-200 dark:divide-slate-700">
                {archives.length > 0 ? (
                  archives.map((row) => (
                    <tr key={row._id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{row.module}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{row.documentType}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{row.documentNumber || '—'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                        {row.deletedBy?.name || '—'}
                        {row.deletedBy?.email && <span className="block text-xs text-gray-500">{row.deletedBy.email}</span>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{formatDate(row.deletedAt)}</td>
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate">{row.reason || '—'}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${row.isRestored ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'}`}>
                          {row.isRestored ? 'Restored' : 'Deleted'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm space-x-2">
                        {!row.isRestored && (
                          <button
                            type="button"
                            onClick={() => handleRestoreClick(row._id)}
                            className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-slate-600 rounded text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700"
                          >
                            <RotateCcw className="h-4 w-4 mr-1" />
                            Restore
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="9" className="px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400">No archived documents found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
        {pages > 1 && (
          <div className="px-6 py-3 bg-gray-50 dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 flex items-center justify-between">
            <p className="text-sm text-gray-600 dark:text-gray-400">Page {page} of {pages} ({total} total)</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                disabled={page >= pages}
                className="px-3 py-1 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 disabled:opacity-50"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* Restore confirmation modal */}
      {showRestoreModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => !actionLoading && setShowRestoreModal(false)} />
          <div className="relative bg-white dark:bg-slate-900 rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Restore document?</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">The document will be restored to its module and removed from the archive. This action can be done again if you delete it later.</p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => !actionLoading && setShowRestoreModal(false)}
                className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-md text-gray-700 dark:text-gray-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmRestore}
                disabled={actionLoading}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-md disabled:opacity-50"
              >
                {actionLoading ? 'Restoring...' : 'Restore'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ArchivePage;
