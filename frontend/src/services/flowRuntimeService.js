import api from './api';

export const startFlowSession = (flowId, payload = {}) =>
    api.post(`/flows/${flowId}/start`, payload);

export const submitFlowSession = (flowId, sessionId, payload = {}) =>
    api.post(`/flows/${flowId}/sessions/${sessionId}/submit`, payload);
