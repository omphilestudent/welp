import React, { useEffect, useState } from 'react';
import Loading from '../../components/common/Loading';
import {
    listTemplates,
    createTemplate,
    updateTemplate,
    previewTemplate,
    listCampaigns,
    updateCampaign,
    runCampaign,
    listTriggers,
    updateTrigger,
    listLogs,
    getSettings,
    updateSettings
} from '../../services/marketingService';
import MarketingTemplateList from '../../components/admin/marketing/MarketingTemplateList';
import MarketingTemplateEditor from '../../components/admin/marketing/MarketingTemplateEditor';
import MarketingTemplatePreview from '../../components/admin/marketing/MarketingTemplatePreview';
import MarketingCampaignScheduler from '../../components/admin/marketing/MarketingCampaignScheduler';
import MarketingTriggerList from '../../components/admin/marketing/MarketingTriggerList';
import MarketingDeliveryLogs from '../../components/admin/marketing/MarketingDeliveryLogs';
import MarketingSettingsPanel from '../../components/admin/marketing/MarketingSettingsPanel';

const AdminMarketing = () => {
    const [loading, setLoading] = useState(true);
    const [templates, setTemplates] = useState([]);
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [preview, setPreview] = useState(null);
    const [campaigns, setCampaigns] = useState([]);
    const [triggers, setTriggers] = useState([]);
    const [logs, setLogs] = useState([]);
    const [logFilters, setLogFilters] = useState({ status: '', audience: '' });
    const [settings, setSettings] = useState({});
    const [error, setError] = useState('');
    const [bulkUpdating, setBulkUpdating] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const [tpl, camp, trg, logRows, set] = await Promise.all([
                listTemplates(),
                listCampaigns(),
                listTriggers(),
                listLogs(),
                getSettings()
            ]);
            setTemplates(tpl || []);
            setCampaigns(camp || []);
            setTriggers(trg || []);
            setLogs(logRows || []);
            setSettings(set || {});
            if ((tpl || []).length) {
                setSelectedTemplate((prev) => prev || tpl[0]);
                const previewData = await previewTemplate((tpl[0]).id, {
                    variables: {
                        first_name: 'Alex',
                        full_name: 'Alex Doe',
                        product_name: 'Welp Growth',
                        subscription_name: 'Pro Plan',
                        company_name: 'Welp',
                        review_count: '12',
                        register_link: '#',
                        chat_link: '#',
                        sender_name: 'Welp Team'
                    }
                });
                setPreview(previewData);
            }
        } catch (err) {
            setError('Failed to load marketing data.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const handleSaveTemplate = async (payload) => {
        const updated = await updateTemplate(payload.id, payload);
        setTemplates((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
        setSelectedTemplate(updated);
        const previewData = await previewTemplate(updated.id, {
            variables: {
                first_name: 'Alex',
                full_name: 'Alex Doe',
                product_name: 'Welp Growth',
                subscription_name: 'Pro Plan',
                company_name: 'Welp',
                review_count: '12',
                register_link: '#',
                chat_link: '#',
                sender_name: 'Welp Team'
            }
        });
        setPreview(previewData);
    };

    const handleCreateTemplate = async () => {
        const key = `custom_${Date.now()}`;
        const created = await createTemplate({
            key,
            name: 'New Template',
            category: 'marketing',
            audience: 'employee',
            subject: 'New marketing email',
            preheader: 'Preview text',
            html_body: '<p>Hello {{first_name}},</p><p>Welcome to Welp.</p>',
            text_body: 'Hello {{first_name}}, Welcome to Welp.',
            is_active: true
        });
        setTemplates((prev) => [created, ...prev]);
        setSelectedTemplate(created);
        const previewData = await previewTemplate(created.id, {
            variables: {
                first_name: 'Alex',
                full_name: 'Alex Doe',
                product_name: 'Welp Growth',
                subscription_name: 'Pro Plan',
                company_name: 'Welp',
                review_count: '12',
                register_link: '#',
                chat_link: '#',
                sender_name: 'Welp Team'
            }
        });
        setPreview(previewData);
    };

    const handleUpdateCampaign = async (id, payload) => {
        const updated = await updateCampaign(id, payload);
        setCampaigns((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    };

    const handleRunCampaign = async (id) => {
        await runCampaign(id);
        const logRows = await listLogs();
        setLogs(logRows || []);
    };

    const handleUpdateTrigger = async (key, payload) => {
        const updated = await updateTrigger(key, payload);
        setTriggers((prev) => prev.map((t) => (t.trigger_key === updated.trigger_key ? updated : t)));
    };

    const handleLogsFilter = async (filters) => {
        setLogFilters(filters);
        const logRows = await listLogs(filters);
        setLogs(logRows || []);
    };

    const handleSaveSettings = async (payload) => {
        const saved = await updateSettings(payload);
        setSettings(saved);
    };

    const handleEnableMarketing = async () => {
        setBulkUpdating(true);
        try {
            const saved = await updateSettings({
                ...settings,
                employee_marketing_enabled: true,
                psychologist_marketing_enabled: true
            });
            setSettings(saved);
        } finally {
            setBulkUpdating(false);
        }
    };

    const handleActivateAllCampaigns = async () => {
        setBulkUpdating(true);
        try {
            const updates = await Promise.all(
                (campaigns || []).map((campaign) =>
                    campaign.is_active ? campaign : updateCampaign(campaign.id, { is_active: true })
                )
            );
            const normalized = updates.map((item, index) => item || campaigns[index]);
            setCampaigns(normalized);
        } finally {
            setBulkUpdating(false);
        }
    };

    const activeCampaigns = campaigns.filter((c) => c.is_active);
    const inactiveCampaigns = campaigns.filter((c) => !c.is_active);
    const inactiveTemplates = templates.filter((t) => t.is_active === false);
    const marketingDisabled = settings.employee_marketing_enabled === false || settings.psychologist_marketing_enabled === false;

    if (loading) {
        return <Loading />;
    }

    return (
        <div className="admin-marketing">
            <div className="marketing-page-header">
                <div>
                    <h1>Admin Marketing</h1>
                    <p>Manage campaigns, templates, triggers, and delivery performance.</p>
                </div>
            </div>
            {error && <div className="marketing-error">{error}</div>}
            {(marketingDisabled || inactiveCampaigns.length || inactiveTemplates.length) && (
                <div className="marketing-error" style={{ background: '#fef3c7', color: '#92400e' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                        <div>
                            <strong>Delivery is paused or partially disabled.</strong>
                            <div style={{ fontSize: '0.85rem', marginTop: '0.35rem' }}>
                                {marketingDisabled && 'Global marketing settings are disabled. '}
                                {inactiveCampaigns.length > 0 && `${inactiveCampaigns.length} campaign(s) are inactive. `}
                                {inactiveTemplates.length > 0 && `${inactiveTemplates.length} template(s) are inactive.`}
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            {marketingDisabled && (
                                <button className="btn-secondary" onClick={handleEnableMarketing} disabled={bulkUpdating}>
                                    Enable marketing
                                </button>
                            )}
                            {inactiveCampaigns.length > 0 && (
                                <button className="btn-secondary" onClick={handleActivateAllCampaigns} disabled={bulkUpdating}>
                                    Activate all campaigns
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
            <div className="marketing-grid">
                <MarketingTemplateList
                    templates={templates}
                    selectedId={selectedTemplate?.id}
                    onSelect={async (tpl) => {
                        setSelectedTemplate(tpl);
                        const previewData = await previewTemplate(tpl.id, {
                            variables: {
                                first_name: 'Alex',
                                full_name: 'Alex Doe',
                                product_name: 'Welp Growth',
                                subscription_name: 'Pro Plan',
                                company_name: 'Welp',
                                review_count: '12',
                                register_link: '#',
                                chat_link: '#',
                                sender_name: 'Welp Team'
                            }
                        });
                        setPreview(previewData);
                    }}
                    onCreate={handleCreateTemplate}
                />
                <MarketingTemplateEditor template={selectedTemplate} onSave={handleSaveTemplate} />
                <MarketingTemplatePreview preview={preview} />
            </div>

            <div className="marketing-section">
                <div className="marketing-section__header">
                    <h2>Campaign Scheduler</h2>
                </div>
                <MarketingCampaignScheduler
                    campaigns={campaigns}
                    onUpdate={handleUpdateCampaign}
                    onRun={handleRunCampaign}
                />
            </div>

            <div className="marketing-section">
                <div className="marketing-section__header">
                    <h2>Trigger Emails</h2>
                </div>
                <MarketingTriggerList
                    triggers={triggers}
                    onUpdate={handleUpdateTrigger}
                />
            </div>

            <div className="marketing-section">
                <div className="marketing-section__header">
                    <h2>Delivery Logs</h2>
                </div>
                <MarketingDeliveryLogs
                    logs={logs}
                    filters={logFilters}
                    onFilter={handleLogsFilter}
                    campaigns={campaigns}
                    triggers={triggers}
                />
            </div>

            <div className="marketing-section">
                <div className="marketing-section__header">
                    <h2>Settings</h2>
                </div>
                <MarketingSettingsPanel settings={settings} onSave={handleSaveSettings} />
            </div>
        </div>
    );
};

export default AdminMarketing;
