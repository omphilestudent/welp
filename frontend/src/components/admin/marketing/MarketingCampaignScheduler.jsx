import React from 'react';

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

const MarketingCampaignScheduler = ({ campaigns = [], onUpdate, onRun }) => (
    <div>
        {campaigns.map((campaign) => (
            <div key={campaign.id} className="marketing-card">
                <div>
                    <strong>{campaign.name}</strong>
                    <p className="text-xs text-secondary">{campaign.audience_type}</p>
                    <p className="text-xs text-secondary">
                        Last run: {campaign.last_run_at ? new Date(campaign.last_run_at).toLocaleString() : 'Never'}
                    </p>
                    <p className="text-xs text-secondary">
                        Next run: {campaign.next_run_at ? new Date(campaign.next_run_at).toLocaleString() : 'Not scheduled'}
                    </p>
                </div>
                <div className="marketing-days">
                    {DAYS.map((day) => (
                        <label key={day}>
                            <input
                                type="checkbox"
                                checked={(campaign.days_of_week || []).includes(day)}
                                onChange={() => {
                                    const current = new Set(campaign.days_of_week || []);
                                    if (current.has(day)) current.delete(day); else current.add(day);
                                    onUpdate(campaign.id, { days_of_week: Array.from(current) });
                                }}
                            />
                            {day.slice(0,3)}
                        </label>
                    ))}
                </div>
                <div className="marketing-card__actions">
                    <label>
                        <input
                            type="checkbox"
                            checked={campaign.is_active}
                            onChange={(e) => onUpdate(campaign.id, { is_active: e.target.checked })}
                        />
                        Active
                    </label>
                    <button className="btn-secondary" onClick={() => onRun(campaign.id)}>Run Now</button>
                </div>
            </div>
        ))}
    </div>
);

export default MarketingCampaignScheduler;
