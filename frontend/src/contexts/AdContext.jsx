import React, { createContext, useCallback, useContext, useRef } from 'react';
import { fetchPlacementAds } from '../services/adService';

const AdContext = createContext(null);

const CACHE_TTL_MS = 60_000;
const COOLDOWN_MS = 10_000;

const normalizeBehaviors = (behaviors) => {
    if (!behaviors) return [];
    if (Array.isArray(behaviors)) return behaviors.filter(Boolean).map(String).sort();
    return String(behaviors).split(',').map((value) => value.trim()).filter(Boolean).sort();
};

const buildKey = ({ placement, location, industry, behaviors }) => {
    const normalized = {
        placement: placement || '',
        location: location || '',
        industry: industry || '',
        behaviors: normalizeBehaviors(behaviors)
    };
    return JSON.stringify(normalized);
};

export const AdProvider = ({ children }) => {
    const cacheRef = useRef(new Map());

    const fetchPlacementAdsCached = useCallback(async (params = {}) => {
        const key = buildKey(params);
        const now = Date.now();
        const cached = cacheRef.current.get(key);

        if (cached?.data && now - cached.fetchedAt < CACHE_TTL_MS) {
            return cached.data;
        }

        if (cached?.promise && now - cached.lastFetch < COOLDOWN_MS) {
            return cached.promise;
        }

        const fetchPromise = fetchPlacementAds(params)
            .then((response) => response.data)
            .then((data) => {
                cacheRef.current.set(key, {
                    data,
                    fetchedAt: Date.now(),
                    lastFetch: Date.now(),
                    promise: null
                });
                return data;
            })
            .catch((error) => {
                cacheRef.current.set(key, {
                    data: cached?.data || null,
                    fetchedAt: cached?.fetchedAt || 0,
                    lastFetch: Date.now(),
                    promise: null
                });
                throw error;
            });

        cacheRef.current.set(key, {
            data: cached?.data || null,
            fetchedAt: cached?.fetchedAt || 0,
            lastFetch: now,
            promise: fetchPromise
        });

        return fetchPromise;
    }, []);

    const value = {
        fetchPlacementAdsCached
    };

    return (
        <AdContext.Provider value={value}>
            {children}
        </AdContext.Provider>
    );
};

export const useAdsContext = () => {
    const context = useContext(AdContext);
    if (!context) {
        throw new Error('useAdsContext must be used within an AdProvider');
    }
    return context;
};
