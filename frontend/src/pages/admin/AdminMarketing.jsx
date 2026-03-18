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

    if (loading) {
        return <Loading />;
    }

    return (
        <div className="admin-marketing">
            <h1>Admin Marketing</h1>
            {error && <div className="marketing-error">{error}</div>}
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

            <MarketingCampaignScheduler
                campaigns={campaigns}
                onUpdate={handleUpdateCampaign}
                onRun={handleRunCampaign}
            />

            <MarketingTriggerList
                triggers={triggers}
                onUpdate={handleUpdateTrigger}
            />

            <MarketingDeliveryLogs
                logs={logs}
                filters={logFilters}
                onFilter={handleLogsFilter}
                campaigns={campaigns}
                triggers={triggers}
            />

            <MarketingSettingsPanel settings={settings} onSave={handleSaveSettings} />
        </div>
    );
};

export default AdminMarketing;
