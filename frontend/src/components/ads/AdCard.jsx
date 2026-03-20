import React from 'react';

const formatNumber = (value) => {
    if (value === null || value === undefined) return '0';
    return Number(value).toLocaleString();
};

const formatCurrency = (value) => {
    if (value === null || value === undefined) return '$0.00';
    const numeric = typeof value === 'string' ? Number(value) : value;
    const major = Number.isNaN(numeric) ? 0 : numeric;
    return `$${major.toFixed(2)}`;
};

const formatDate = (value) => {
    if (!value) return '—';
    try {
        return new Date(value).toLocaleDateString();
    } catch {
        return '—';
    }
};

const AdCard = ({ ad, onEdit, onDelete }) => {
    const ctr = ad.ctr ?? (ad.impressions > 0 ? Number(((ad.clicks / ad.impressions) * 100).toFixed(2)) : 0);
    const spend = ad.spend_minor ? ad.spend_minor / 100 : Number(ad.spendMajor || 0);
    const startsAt = ad.starts_at ? formatDate(ad.starts_at) : '—';
    const endsAt = ad.ends_at ? formatDate(ad.ends_at) : '—';
    const imageCount = Array.isArray(ad.images) ? ad.images.length : 0;

    return (
        <article className="ad-card">
            <header className="ad-card__header">
                <div>
                    <p className="ad-card__eyebrow">{ad.review_status || 'pending'}</p>
                    <h3>{ad.name || 'Untitled Campaign'}</h3>
                    <p className="ad-card__dates">
                        Submitted {formatDate(ad.submitted_at)} {ad.reviewed_at ? `· Reviewed ${formatDate(ad.reviewed_at)}` : ''}
                    </p>
                </div>
                <span className={`ad-card__status ad-card__status--${ad.status || 'pending'}`}>
                    {ad.status || 'pending'}
                </span>
            </header>
            <dl className="ad-card__metrics">
                <div>
                    <dt>Impressions</dt>
                    <dd>{formatNumber(ad.impressions)}</dd>
                </div>
                <div>
                    <dt>Clicks</dt>
                    <dd>{formatNumber(ad.clicks)}</dd>
                </div>
                <div>
                    <dt>CTR</dt>
                    <dd>{ctr}%</dd>
                </div>
                <div>
                    <dt>Spend</dt>
                    <dd>{formatCurrency(spend)}</dd>
                </div>
            </dl>
            <div className="ad-card__placements">
                <span>Placements:</span>
                <strong>{ad.placements?.map((item) => item.placement).join(', ') || '—'}</strong>
            </div>
            <div className="ad-card__placements">
                <span>Window:</span>
                <strong>{startsAt} → {endsAt}</strong>
            </div>
            <div className="ad-card__placements">
                <span>Priority:</span>
                <strong>{ad.priority_level || 1}</strong>
                <span>Images:</span>
                <strong>{imageCount}</strong>
            </div>
            <footer className="ad-card__footer">
                <div className="ad-card__notes">
                    {ad.review_notes && (
                        <p>
                            Notes: <span>{ad.review_notes}</span>
                        </p>
                    )}
                </div>
                <div className="ad-card__actions">
                    <button type="button" onClick={() => onEdit(ad)}>
                        Edit
                    </button>
                    <button type="button" className="danger" onClick={() => onDelete(ad.id)}>
                        Delete
                    </button>
                </div>
            </footer>
        </article>
    );
};

export default AdCard;
