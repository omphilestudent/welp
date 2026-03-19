import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import Loading from '../../../components/common/Loading';
import PortalNav from '../../../components/kodi/portal/PortalNav';
import { createPlatformField, createPlatformObject, listPlatformObjects } from '../../../services/kodiPageService';

const PortalObjects = () => {
    const [objects, setObjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [fieldModal, setFieldModal] = useState({
        open: false,
        object: null,
        fieldName: '',
        fieldType: 'string',
        isRequired: false,
        isReadonly: false,
        saving: false
    });
    const [objectModal, setObjectModal] = useState({
        open: false,
        name: '',
        label: '',
        description: '',
        saving: false
    });

    const load = async () => {
        setLoading(true);
        try {
            const data = await listPlatformObjects();
            setObjects(Array.isArray(data) ? data : []);
        } catch (error) {
            toast.error('Unable to load CRM objects');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const openFieldModal = (object) => {
        setFieldModal({
            open: true,
            object,
            fieldName: '',
            fieldType: 'string',
            isRequired: false,
            isReadonly: false,
            saving: false
        });
    };

    const closeFieldModal = () => {
        setFieldModal((prev) => ({ ...prev, open: false }));
    };

    const openObjectModal = () => {
        setObjectModal({ open: true, name: '', label: '', description: '', saving: false });
    };

    const closeObjectModal = () => {
        setObjectModal((prev) => ({ ...prev, open: false }));
    };

    const handleCreateObject = async () => {
        if (!objectModal.name.trim() || !objectModal.label.trim()) return;
        setObjectModal((prev) => ({ ...prev, saving: true }));
        try {
            await createPlatformObject({
                name: objectModal.name.trim().toLowerCase(),
                label: objectModal.label.trim(),
                description: objectModal.description.trim()
            });
            toast.success('Object created');
            closeObjectModal();
            load();
        } catch (error) {
            toast.error(error?.response?.data?.error || 'Failed to create object');
            setObjectModal((prev) => ({ ...prev, saving: false }));
        }
    };

    const handleCreateField = async () => {
        if (!fieldModal.fieldName.trim() || !fieldModal.object?.id) return;
        setFieldModal((prev) => ({ ...prev, saving: true }));
        try {
            await createPlatformField(fieldModal.object.id, {
                fieldName: fieldModal.fieldName.trim(),
                fieldType: fieldModal.fieldType,
                isRequired: fieldModal.isRequired,
                isReadonly: fieldModal.isReadonly
            });
            toast.success('Field added');
            closeFieldModal();
            load();
        } catch (error) {
            toast.error(error?.response?.data?.error || 'Failed to add field');
            setFieldModal((prev) => ({ ...prev, saving: false }));
        }
    };

    return (
        <div className="kodi-portal-screen">
            <header className="kodi-portal-header">
                <div>
                    <p className="kodi-portal-eyebrow">Kodi Portal</p>
                    <h1>CRM Objects</h1>
                </div>
                <button className="btn-primary" onClick={openObjectModal}>Create Object</button>
            </header>
            <PortalNav />
            {loading ? (
                <Loading />
            ) : (
                <section className="kodi-portal-section">
                    <div className="kodi-portal-object-grid">
                        {objects.map((object) => (
                            <article key={object.id} className="kodi-portal-object-card">
                                <div className="kodi-portal-object-card__header">
                                    <div>
                                        <h3>{object.label}</h3>
                                        <p>{object.description || 'No description available.'}</p>
                                    </div>
                                    <button className="btn-text" onClick={() => openFieldModal(object)}>
                                        + Add field
                                    </button>
                                </div>
                                <div className="kodi-portal-object-fields">
                                    {(object.fields || []).map((field) => (
                                        <span key={field.id} className="kodi-portal-object-chip">
                                            {field.field_name} ({field.field_type})
                                        </span>
                                    ))}
                                    {!object.fields?.length && (
                                        <p className="kodi-portal-empty">No fields defined.</p>
                                    )}
                                </div>
                            </article>
                        ))}
                        {!objects.length && (
                            <p className="kodi-portal-empty">No metadata objects available.</p>
                        )}
                    </div>
                </section>
            )}
            {fieldModal.open && (
                <div className="kodi-portal-modal">
                    <div className="kodi-portal-modal__content">
                        <div className="kodi-portal-modal__header">
                            <h2>Add field</h2>
                            <button className="btn-text" onClick={closeFieldModal}>Close</button>
                        </div>
                        <label>
                            Field name
                            <input
                                value={fieldModal.fieldName}
                                onChange={(event) => setFieldModal((prev) => ({ ...prev, fieldName: event.target.value }))}
                            />
                        </label>
                        <label>
                            Field type
                            <select
                                value={fieldModal.fieldType}
                                onChange={(event) => setFieldModal((prev) => ({ ...prev, fieldType: event.target.value }))}
                            >
                                <option value="string">String</option>
                                <option value="number">Number</option>
                                <option value="boolean">Boolean</option>
                                <option value="date">Date</option>
                            </select>
                        </label>
                        <div className="kodi-portal-checkboxes">
                            <label>
                                <input
                                    type="checkbox"
                                    checked={fieldModal.isRequired}
                                    onChange={() => setFieldModal((prev) => ({ ...prev, isRequired: !prev.isRequired }))}
                                />
                                Required
                            </label>
                            <label>
                                <input
                                    type="checkbox"
                                    checked={fieldModal.isReadonly}
                                    onChange={() => setFieldModal((prev) => ({ ...prev, isReadonly: !prev.isReadonly }))}
                                />
                                Read only
                            </label>
                        </div>
                        <button
                            className="btn-primary"
                            onClick={handleCreateField}
                            disabled={!fieldModal.fieldName.trim() || fieldModal.saving}
                        >
                            {fieldModal.saving ? 'Saving...' : 'Add field'}
                        </button>
                    </div>
                </div>
            )}
            {objectModal.open && (
                <div className="kodi-portal-modal">
                    <div className="kodi-portal-modal__content">
                        <div className="kodi-portal-modal__header">
                            <h2>Create object</h2>
                            <button className="btn-text" onClick={closeObjectModal}>Close</button>
                        </div>
                        <label>
                            Object name (API)
                            <input
                                value={objectModal.name}
                                onChange={(event) => setObjectModal((prev) => ({ ...prev, name: event.target.value }))}
                                placeholder="account"
                            />
                        </label>
                        <label>
                            Label
                            <input
                                value={objectModal.label}
                                onChange={(event) => setObjectModal((prev) => ({ ...prev, label: event.target.value }))}
                                placeholder="Account"
                            />
                        </label>
                        <label>
                            Description
                            <textarea
                                rows={3}
                                value={objectModal.description}
                                onChange={(event) => setObjectModal((prev) => ({ ...prev, description: event.target.value }))}
                            />
                        </label>
                        <button
                            className="btn-primary"
                            onClick={handleCreateObject}
                            disabled={!objectModal.name.trim() || !objectModal.label.trim() || objectModal.saving}
                        >
                            {objectModal.saving ? 'Saving...' : 'Create object'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PortalObjects;
