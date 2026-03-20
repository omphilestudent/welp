import React, { useEffect, useMemo, useState } from 'react';
import { recordClick, recordImpression } from '../../services/adService';
import './CompactSponsoredCard.css';

const CompactSponsoredCard = ({ campaign, onClick }) => {
    const [mediaIndex, setMediaIndex] = useState(0);
    useEffect(() => {
        if (!campaign || campaign.__static) return;
        const track = async () => {
            try {
                await recordImpression(campaign.id);
            } catch {
                // ignore
            }
        };
        track();
    }, [campaign]);

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

    const mediaNode = useMemo(() => {
        if (!campaign || !mediaItems.length) return null;
        const media = mediaItems[mediaIndex] || mediaItems[0];
        if (media.media_type === 'video') {
            return (
                <video
                    className="compact-ad__media"
                    src={media.asset_url}
                    muted
                    loop
                    playsInline
                />
            );
        }
        return (
            <img
                className="compact-ad__media"
                src={media.asset_url}
                alt={media.alt_text || campaign.name}
                loading="lazy"
            />
        );
    }, [campaign, mediaItems, mediaIndex]);

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
            if (data?.redirectUrl) {
                window.open(data.redirectUrl, '_blank', 'noopener');
            }
        } catch {
            // ignore
        }
        if (onClick) onClick(campaign);
    };

    if (!campaign) return null;

    return (
        <article className="compact-ad" onClick={handleClick}>
            {mediaNode}
            <div className="compact-ad__content">
                <span className="compact-ad__badge">Sponsored</span>
                <p className="compact-ad__title">{campaign.name}</p>
            </div>
        </article>
    );
};

export default CompactSponsoredCard;
