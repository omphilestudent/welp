import React, { useEffect, useMemo, useState } from 'react';
import { recordClick, recordImpression, fetchPlacementAds } from '../../services/adService';
import './SponsoredCard.css';

const STATIC_REDIRECT_URL = 'https://welp.africa/static';
const STATIC_AD = {
    id: 'welp-care-static',
    name: 'Because We Care',
    advertiser: 'Welp Camping',
    media_type: 'image',
    asset_url: '/logo-1.png',
    click_redirect_url: STATIC_REDIRECT_URL,
    location: 'Johannesburg',
    status: 'active',
    daily_budget_minor: 0,
    __static: true
};

const SponsoredCard = ({
    placement = 'recommended',
    location = '',
    industry = '',
    behaviors = [],
    rotateIntervalMs = 45000
}) => {
    const [campaigns, setCampaigns] = useState([]);
    const [activeIndex, setActiveIndex] = useState(0);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        let isMounted = true;
        const load = async () => {
            setLoading(true);
            try {
                const { data } = await fetchPlacementAds({ placement, location, industry, behaviors });
                if (!isMounted) return;
                const available = Array.isArray(data?.campaigns) && data.campaigns.length
                    ? data.campaigns
                    : [{ ...STATIC_AD }];
                setCampaigns(available);
                setActiveIndex(0);
            } catch (error) {
                console.error('Failed to load ads', error);
                if (isMounted) {
                    setCampaigns([{ ...STATIC_AD }]);
                    setActiveIndex(0);
                }
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
        if (campaigns.length <= 1) return undefined;
        const interval = setInterval(() => {
            setActiveIndex((prev) => (prev + 1) % campaigns.length);
        }, Math.max(rotateIntervalMs, 10000));
        return () => clearInterval(interval);
    }, [campaigns, rotateIntervalMs]);

    const campaign = campaigns[activeIndex] || null;

    useEffect(() => {
        if (!campaign || campaign.__static) return;
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
        if (campaign.__static) {
            if (campaign.click_redirect_url) {
                window.open(campaign.click_redirect_url, '_blank', 'noopener');
            }
            return;
        }
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

    if (!campaign || loading) return null;

    return (
        <article className="sponsored-card" onClick={handleClick}>
            {mediaNode}
            <div className="sponsored-card__content">
                <span className="sponsored-card__badge">Sponsored</span>
                <h3>{campaign.name}</h3>
                {campaign.advertiser && (
                    <p className="sponsored-card__meta">
                        {campaign.advertiser}
                    </p>
                )}
                {campaign.tagline && (
                    <p className="sponsored-card__meta">
                        {campaign.tagline}
                    </p>
                )}
                {campaign.location && (
                    <p className="sponsored-card__meta">
                        {campaign.location}
                    </p>
                )}
            </div>
        </article>
    );
};

export default SponsoredCard;
