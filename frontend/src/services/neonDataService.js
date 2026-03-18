import axios from 'axios';

const NEON_DATA_API_URL = import.meta.env.VITE_NEON_DATA_API_URL?.replace(/\/$/, '') || '';
const NEON_DATA_API_KEY = import.meta.env.VITE_NEON_DATA_API_KEY || '';

const neonDataApiClient = axios.create({
    baseURL: NEON_DATA_API_URL,
    headers: {
        'Content-Type': 'application/json',
        ...(NEON_DATA_API_KEY ? { apikey: NEON_DATA_API_KEY } : {})
    }
});

const ensureConfigured = () => {
    if (!NEON_DATA_API_URL) {
        throw new Error('Neon Data API URL is not configured. Set VITE_NEON_DATA_API_URL.');
    }
};

export const fetchTableRecords = async (tableName, params = {}) => {
    ensureConfigured();
    const normalized = tableName?.toString().trim();
    if (!normalized) {
        throw new Error('Table name is required to query the Neon Data API.');
    }
    const response = await neonDataApiClient.get(`/${normalized}`, { params });
    return response.data;
};

export const createTableRecord = async (tableName, payload) => {
    ensureConfigured();
    const normalized = tableName?.toString().trim();
    if (!normalized) {
        throw new Error('Table name is required to insert a record.');
    }
    const response = await neonDataApiClient.post(`/${normalized}`, payload);
    return response.data;
};

export const updateTableRecord = async (tableName, key, payload) => {
    ensureConfigured();
    const normalized = tableName?.toString().trim();
    if (!normalized) {
        throw new Error('Table name is required to update a record.');
    }
    if (!key) {
        throw new Error('Record key is required when updating a table record.');
    }
    const response = await neonDataApiClient.patch(`/${normalized}`, payload, {
        params: { id: `eq.${key}` }
    });
    return response.data;
};

export const deleteTableRecord = async (tableName, key) => {
    ensureConfigured();
    const normalized = tableName?.toString().trim();
    if (!normalized) {
        throw new Error('Table name is required to delete a record.');
    }
    if (!key) {
        throw new Error('Record key is required when deleting a table record.');
    }
    const response = await neonDataApiClient.delete(`/${normalized}`, {
        params: { id: `eq.${key}` }
    });
    return response.data;
};

export default neonDataApiClient;
