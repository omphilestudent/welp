import api from './api';

const basePath = '/admin/flows';

export const fetchFlows = (params = {}) => api.get(basePath, { params });
export const createFlow = (payload) => api.post(basePath, payload);
export const updateFlow = (id, payload) => api.put(`${basePath}/${id}`, payload);
export const deleteFlow = (id) => api.delete(`${basePath}/${id}`);
export const fetchFlowLogs = (id, params = {}) => api.get(`${basePath}/${id}/logs`, { params });
export const executeFlow = (id, context = {}) => api.post(`${basePath}/${id}/execute`, { context });

export const fetchFlowEvents = () => api.get(`${basePath}/meta/events`);
export const fetchFlowTriggers = () => api.get(`${basePath}/triggers`);
export const createFlowTrigger = (payload) => api.post(`${basePath}/triggers`, payload);
export const updateFlowTrigger = (id, payload) => api.put(`${basePath}/triggers/${id}`, payload);
export const deleteFlowTrigger = (id) => api.delete(`${basePath}/triggers/${id}`);
