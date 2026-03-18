const cron = require('node-cron');
const { listCampaigns, runCampaign, getSettings } = require('./marketing.service');

const shouldRunToday = (campaign, fallbackDays = []) => {
    const days = campaign.days_of_week?.length ? campaign.days_of_week : fallbackDays;
    if (!Array.isArray(days) || days.length === 0) return false;
    const day = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    return days.includes(day);
};

const getNextRunDate = (campaign, fallbackDays = []) => {
    const days = campaign.days_of_week?.length ? campaign.days_of_week : fallbackDays;
    if (!Array.isArray(days) || days.length === 0) return null;
    const map = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const today = new Date();
    for (let i = 1; i <= 7; i += 1) {
        const candidate = new Date(today);
        candidate.setDate(today.getDate() + i);
        if (days.includes(map[candidate.getDay()])) return candidate;
    }
    return null;
};

const runScheduledCampaigns = async () => {
    const campaigns = await listCampaigns();
    const settings = await getSettings();
    const defaultDays = settings.default_campaign_days || ['Monday', 'Wednesday', 'Friday'];
    for (const campaign of campaigns) {
        if (!campaign.is_active) continue;
        if (campaign.send_type !== 'scheduled') continue;
        if (!shouldRunToday(campaign, defaultDays)) continue;
        await runCampaign(campaign);
        const nextRun = getNextRunDate(campaign, defaultDays);
        if (nextRun) {
            await require('../../utils/database').query(
                `UPDATE marketing_campaigns SET next_run_at = $1 WHERE id = $2`,
                [nextRun, campaign.id]
            );
        }
    }
};

const startScheduler = () => {
    cron.schedule('0 9 * * *', () => {
        runScheduledCampaigns().catch((error) => {
            console.error('Marketing scheduler failed:', error.message);
        });
    });
};

module.exports = {
    startScheduler,
    runScheduledCampaigns
};
