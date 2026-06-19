import axios from 'axios';

const BASE = '/api/inventory/others';

export function fetchOthersItems() {
  return axios.get(BASE);
}

export function createOthersItem(data) {
  return axios.post(BASE, data);
}

export function updateOthersItem(id, data) {
  return axios.put(`${BASE}/${id}`, data);
}

export function deleteOthersItem(id) {
  return axios.delete(`${BASE}/${id}`);
}

export function getApiErrorMessage(error, fallback = 'Request failed') {
  const apiErrors = error.response?.data?.errors;
  if (Array.isArray(apiErrors) && apiErrors.length > 0) {
    return apiErrors[0].msg || error.response?.data?.message || fallback;
  }
  return error.response?.data?.message || fallback;
}
