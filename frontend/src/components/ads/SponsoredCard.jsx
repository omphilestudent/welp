import React, { useEffect, useMemo, useState } from 'react';
import { recordClick, recordImpression } from '../../services/adService';
import { usePlacementAds } from '../../hooks/usePlacementAds';
import './SponsoredCard.css';

const SponsoredCard = ({
    placement = 'recommended',
    location = '',
    industry = '',
    behaviors = [],
    rotateIntervalMs = 45000
}) => {
    const [activeIndex, setActiveIndex] = useState(0);
    const { campaigns, loading } = usePlacementAds({ placement, location, industry, behaviors });

    useEffect(() => {
        setActiveIndex(0);
    }, [campaigns]);

    useEffect(() => {
        if (campaigns.length <= 1) return undefined;
        const interval = setInterval(() => {
            setActiveIndex((prev) => (prev + 1) % campaigns.length);
        }, Math.max(rotateIntervalMs, 10000));
        return () => clearInterval(interval);
    }, [campaigns, rotateIntervalMs]);

    const campaign = campaigns[activeIndex] || null;

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

    if (loading || !campaign) return null;

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
