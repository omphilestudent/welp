import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import Loading from '../../components/common/Loading';
import { createKodiPage, listKCComponents, listKodiPages } from '../../services/kodiPageService';

const DEFAULT_LAYOUT = {
    rows: [
        { columns: [{ components: [] }] }
    ]
};

const KodiBuilder = () => {
    const [loading, setLoading] = useState(true);
    const [pages, setPages] = useState([]);
    const [components, setComponents] = useState([]);
    const [selectedPageId, setSelectedPageId] = useState('');

    const selectedPage = useMemo(() => pages.find((p) => p.id === selectedPageId) || null, [pages, selectedPageId]);

    const load = async () => {
        setLoading(true);
        try {
            const [pagesRes, compRes] = await Promise.all([listKodiPages(), listKCComponents()]);
            setPages(pagesRes?.data || []);
            setComponents(compRes?.data || []);
            if (!selectedPageId && (pagesRes?.data || []).length) {
                setSelectedPageId(pagesRes.data[0].id);
            }
        } catch (error) {
            toast.error(error?.response?.data?.error || 'Failed to load Kodi builder data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const handleCreate = async () => {
        const name = window.prompt('Page name?');
        if (!name) return;
        try {
            const res = await createKodiPage({ name, layout: DEFAULT_LAYOUT });
            const created = res?.data;
            if (created?.id) {
                setPages((prev) => [created, ...prev]);
                setSelectedPageId(created.id);
                toast.success('Page created');
            }
        } catch (error) {
            toast.error(error?.response?.data?.error || 'Failed to create page');
        }
    };

    if (loading) return <Loading />;

    return (
        <div style={{ padding: 16 }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <div>
                    <h2 style={{ margin: 0 }}>Kodi Page Builder</h2>
                    <p style={{ marginTop: 6, opacity: 0.8 }}>Basic builder scaffold (grid layout JSON).</p>
                </div>
                <button onClick={handleCreate}>Create page</button>
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16, marginTop: 16 }}>
                <aside style={{ border: '1px solid #eee', borderRadius: 8, padding: 12 }}>
                    <h3>Pages</h3>
                    <select value={selectedPageId} onChange={(e) => setSelectedPageId(e.target.value)} style={{ width: '100%' }}>
                        <option value="" disabled>Select a page</option>
                        {pages.map((p) => (
                            <option key={p.id} value={p.id}>{p.name} ({p.slug})</option>
                        ))}
                    </select>

                    <h3 style={{ marginTop: 16 }}>Component Library</h3>
                    {components.length === 0 ? (
                        <p style={{ opacity: 0.8 }}>No KC components yet.</p>
                    ) : (
                        <div style={{ display: 'grid', gap: 8 }}>
                            {components.slice(0, 20).map((c) => (
                                <div key={c.id} style={{ border: '1px solid #eee', borderRadius: 6, padding: 8 }}>
                                    <strong>{c.component_name}</strong>
                                    <div style={{ opacity: 0.7, fontSize: 12 }}>{c.component_type} · v{c.version}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </aside>

                <main style={{ border: '1px solid #eee', borderRadius: 8, padding: 12 }}>
                    <h3>Page Layout JSON</h3>
                    {selectedPage ? (
                        <pre style={{ overflowX: 'auto', fontSize: 12 }}>
                            {JSON.stringify(selectedPage.layout || {}, null, 2)}
                        </pre>
                    ) : (
                        <p style={{ opacity: 0.8 }}>Select a page to view its layout.</p>
                    )}
                </main>
            </div>
        </div>
    );
};

export default KodiBuilder;

