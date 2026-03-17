import { useEffect, useMemo, useState } from 'react';
import { useAdsContext } from '../contexts/AdContext';

const normalizeBehaviors = (behaviors) => {
    if (!behaviors) return [];
    if (Array.isArray(behaviors)) return behaviors.filter(Boolean).map(String).sort();
    return String(behaviors).split(',').map((value) => value.trim()).filter(Boolean).sort();
};

export const usePlacementAds = ({ placement, location = '', industry = '', behaviors = [] } = {}) => {
    const { fetchPlacementAdsCached } = useAdsContext();
    const [campaigns, setCampaigns] = useState([]);
    const [loading, setLoading] = useState(false);

    const key = useMemo(() => JSON.stringify({
        placement: placement || '',
        location,
        industry,
        behaviors: normalizeBehaviors(behaviors)
    }), [placement, location, industry, behaviors]);

    useEffect(() => {
        let active = true;
        const load = async () => {
            setLoading(true);
            try {
                const data = await fetchPlacementAdsCached({ placement, location, industry, behaviors });
                if (!active) return;
                const list = Array.isArray(data?.campaigns) ? data.campaigns : Array.isArray(data) ? data : [];
                setCampaigns(list);
            } catch (error) {
                if (active) {
                    setCampaigns([]);
                }
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        };
        load();
        return () => {
            active = false;
        };
    }, [key, fetchPlacementAdsCached]);

    return { campaigns, loading };
};
