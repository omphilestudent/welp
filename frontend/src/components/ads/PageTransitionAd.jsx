import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { usePlacementAds } from '../../hooks/usePlacementAds';
import CompactSponsoredCard from './CompactSponsoredCard';
import './PageTransitionAd.css';

const DISPLAY_MS = 4000;

const PageTransitionAd = ({ placement = 'recommended' }) => {
    const location = useLocation();
    const { campaigns } = usePlacementAds({ placement });
    const [visible, setVisible] = useState(false);

    const campaign = useMemo(() => campaigns[0] || null, [campaigns]);

    useEffect(() => {
        if (!campaign) return undefined;
        setVisible(true);
        const timer = setTimeout(() => setVisible(false), DISPLAY_MS);
        return () => clearTimeout(timer);
    }, [location.key, campaign]);

    if (!campaign) return null;

    return (
        <div className={`page-transition-ad ${visible ? 'page-transition-ad--visible' : ''}`}>
            <CompactSponsoredCard campaign={campaign} />
        </div>
    );
};

export default PageTransitionAd;
