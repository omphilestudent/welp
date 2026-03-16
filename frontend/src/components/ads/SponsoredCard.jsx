import React, { useEffect, useMemo, useState } from 'react';
import { recordClick, recordImpression, fetchPlacementAds } from '../../services/adService';
import './SponsoredCard.css';

const STATIC_REDIRECT_URL = 'https://welp.africa/static';
const STATIC_AD = {
    id: 'welp-care-static',
    name: 'Bacause We Care',
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
                if (data.campaigns?.length) {
                    setCampaign(data.campaigns[0]);
                } else {
                    setCampaign({ ...STATIC_AD });
                }
            } catch (error) {
                console.error('Failed to load ads', error);
                if (isMounted) {
                    setCampaign({ ...STATIC_AD });
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
