import React, { useEffect, useMemo, useState } from 'react';
import { recordClick, recordImpression, fetchPlacementAds } from '../../services/adService';
import './SponsoredCard.css';

const SponsoredCard = ({
    placement = 'recommended',
    location = '',
    industry = '',
    behaviors = []
}) => {
    const [campaign, setCampaign] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        let isMounted = true;
        const load = async () => {
            setLoading(true);
            try {
                const { data } = await fetchPlacementAds({ placement, location, industry, behaviors });
                if (!isMounted) return;
                setCampaign(data.campaigns?.[0] || null);
            } catch (error) {
                console.error('Failed to load ads', error);
            } finally {
                if (isMounted) setLoading(false);
            }
        };
        load();
        return () => {
            isMounted = false;
        };
    }, [placement, location, industry, behaviors]);

    useEffect(() => {
        if (!campaign) return;
        const track = async () => {
            try {
                await recordImpression(campaign.id);
            } catch (error) {
                console.error('Impression track failed:', error);
            }
        };
        track();
    }, [campaign]);

    const handleClick = async () => {
        if (!campaign) return;
        try {
            const { data } = await recordClick(campaign.id);
            if (data.redirectUrl) {
                window.open(data.redirectUrl, '_blank');
            }
        } catch (error) {
            console.error('Click tracking failed:', error);
        }
    };

    const mediaNode = useMemo(() => {
        if (!campaign) return null;
        if (campaign.media_type === 'video') {
            return (
                <video
                    className="sponsored-media"
                    src={campaign.asset_url}
                    controls
                    muted
                    loop
                    playsInline
                />
            );
        }
        return (
            <img
                className="sponsored-media"
                src={campaign.asset_url}
                alt={campaign.name}
                loading="lazy"
            />
        );
    }, [campaign]);

    if (!campaign) return null;

    return (
        <article className="sponsored-card" onClick={handleClick}>
            {mediaNode}
            <div className="sponsored-card__content">
                <span className="sponsored-card__badge">Sponsored</span>
                <h3>{campaign.name}</h3>
                <p className="sponsored-card__meta">
                    {campaign.status} · {campaign.daily_budget_minor ? `$${(campaign.daily_budget_minor / 100).toFixed(2)} daily` : 'Budget TBD'}
                </p>
            </div>
        </article>
    );
};

export default SponsoredCard;
