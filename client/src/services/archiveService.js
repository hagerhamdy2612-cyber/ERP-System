import axios from 'axios';

/**
 * @param {Object} params - { page, limit, module, startDate, endDate, documentNumber }
 * @returns {Promise<{ data: Array, total: number, page: number, pages: number }>}
 */
export async function getArchives(params = {}) {
  const { data } = await axios.get('/api/archive', { params });
  return {
    data: data.data || [],
    total: data.total ?? 0,
    page: data.page ?? 1,
    pages: data.pages ?? 0
  };
}

/**
 * @param {string} id - Archive record _id
 * @returns {Promise<Object>} restored document
 */
export async function restoreArchive(id) {
  const { data } = await axios.post(`/api/archive/${id}/restore`);
  return data;
}

/**
 * @param {string} id - Archive record _id
 */
export async function permanentDeleteArchive(id) {
  const { data } = await axios.delete(`/api/archive/${id}/permanent`);
  return data;
}
