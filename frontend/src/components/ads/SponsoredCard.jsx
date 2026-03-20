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
    const [mediaIndex, setMediaIndex] = useState(0);
    const { campaigns, loading } = usePlacementAds({ placement, location, industry, behaviors });

    useEffect(() => {
        setActiveIndex(0);
        setMediaIndex(0);
    }, [campaigns]);

    useEffect(() => {
        if (campaigns.length <= 1) return undefined;
        const interval = setInterval(() => {
            setActiveIndex((prev) => (prev + 1) % campaigns.length);
        }, Math.max(rotateIntervalMs, 10000));
        return () => clearInterval(interval);
    }, [campaigns, rotateIntervalMs]);

    const campaign = campaigns[activeIndex] || null;

    const mediaItems = useMemo(() => {
        if (!campaign) return [];
        if (Array.isArray(campaign.images) && campaign.images.length) {
            return campaign.images;
        }
        return [{ asset_url: campaign.asset_url, media_type: campaign.media_type, alt_text: campaign.name }];
    }, [campaign]);

    useEffect(() => {
        setMediaIndex(0);
        if (mediaItems.length <= 1) return undefined;
        const interval = setInterval(() => {
            setMediaIndex((prev) => (prev + 1) % mediaItems.length);
        }, 5000);
        return () => clearInterval(interval);
    }, [mediaItems]);

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
        if (!campaign || !mediaItems.length) return null;
        const media = mediaItems[mediaIndex] || mediaItems[0];
        if (media.media_type === 'video') {
            return (
                <video
                    className="sponsored-media"
                    src={media.asset_url}
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
                src={media.asset_url}
                alt={media.alt_text || campaign.name}
                loading="lazy"
            />
        );
    }, [campaign, mediaItems, mediaIndex]);

    if (loading || !campaign) return null;

    return (
        <article className="sponsored-card sponsored-card--fade" onClick={handleClick}>
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
