import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import Loading from '../../../components/common/Loading';
import AppPagesTable from '../../../components/kodi/portal/AppPagesTable';
import AssignPageModal from '../../../components/kodi/portal/AssignPageModal';
import NavigationOrderEditor from '../../../components/kodi/portal/NavigationOrderEditor';
import PortalNav from '../../../components/kodi/portal/PortalNav';
import {
    deletePortalPage,
    linkPortalPage,
    listActivatedPages,
    listPortalPages,
    reorderPortalPages,
    updatePortalPage
} from '../../../services/kodiPortalService';

const AppPages = () => {
    const { appId } = useParams();
    const [pages, setPages] = useState([]);
    const [activatedPages, setActivatedPages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [assignOpen, setAssignOpen] = useState(false);
    const [draggingId, setDraggingId] = useState(null);
    const [dropIndex, setDropIndex] = useState(null);

    const load = async () => {
        setLoading(true);
        try {
            const [linked, activated] = await Promise.all([listPortalPages(appId), listActivatedPages()]);
            setPages(linked);
            setActivatedPages(activated);
        } catch (error) {
            toast.error('Failed to load pages');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, [appId]);

    const availablePages = useMemo(() => {
        const linkedIds = new Set(pages.map((p) => p.page_id));
        return activatedPages.filter((p) => !linkedIds.has(p.id));
    }, [pages, activatedPages]);

    const handleAssign = async (payload) => {
        try {
            await linkPortalPage(appId, payload);
            toast.success('Page linked');
            setAssignOpen(false);
            load();
        } catch (error) {
            toast.error(error?.response?.data?.error || 'Failed to link page');
        }
    };

    const handleUpdate = async (page, updates) => {
        try {
            await updatePortalPage(appId, page.mapping_id, updates);
            load();
        } catch (error) {
            toast.error(error?.response?.data?.error || 'Failed to update page');
        }
    };

    const handleRemove = async (page) => {
        try {
            await deletePortalPage(appId, page.mapping_id);
            load();
        } catch (error) {
            toast.error(error?.response?.data?.error || 'Failed to remove page');
        }
    };

    const handleDrop = async (index) => {
        if (!draggingId) return;
        const ordered = [...pages];
        const fromIndex = ordered.findIndex((p) => p.mapping_id === draggingId);
        if (fromIndex === -1) return;
        const [moved] = ordered.splice(fromIndex, 1);
        ordered.splice(index, 0, moved);
        setPages(ordered);
        const orderedIds = ordered.map((p) => p.mapping_id);
        try {
            await reorderPortalPages(appId, { orderedIds });
            toast.success('Navigation order updated');
            load();
        } catch (error) {
            toast.error(error?.response?.data?.error || 'Failed to reorder pages');
        } finally {
            setDraggingId(null);
            setDropIndex(null);
        }
    };

    return (
        <div className="kodi-portal-screen">
            <header className="kodi-portal-header">
                <div>
                    <p className="kodi-portal-eyebrow">Kodi Portal</p>
                    <h1>App Pages</h1>
                </div>
                <button className="btn-primary" onClick={() => setAssignOpen(true)}>Assign Page</button>
            </header>
            <PortalNav />
            <NavigationOrderEditor />
            {loading ? (
                <Loading />
            ) : (
                <AppPagesTable
                    pages={pages}
                    onUpdate={handleUpdate}
                    onRemove={handleRemove}
                    onDragStart={(id) => setDraggingId(id)}
                    onDragOver={(index) => setDropIndex(index)}
                    onDrop={(index) => handleDrop(index)}
                />
            )}
            <AssignPageModal open={assignOpen} pages={availablePages} onClose={() => setAssignOpen(false)} onSubmit={handleAssign} />
        </div>
    );
};

export default AppPages;
