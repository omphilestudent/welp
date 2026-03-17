import React, { useEffect, useMemo } from 'react';
import { recordClick, recordImpression } from '../../services/adService';
import './CompactSponsoredCard.css';

const CompactSponsoredCard = ({ campaign, onClick }) => {
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

    const mediaNode = useMemo(() => {
        if (!campaign) return null;
        if (campaign.media_type === 'video') {
            return (
                <video
                    className="compact-ad__media"
                    src={campaign.asset_url}
                    muted
                    loop
                    playsInline
                />
            );
        }
        return (
            <img
                className="compact-ad__media"
                src={campaign.asset_url}
                alt={campaign.name}
                loading="lazy"
            />
        );
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
