import React, { useMemo } from 'react';
import DataTable from './components/DataTable';
import Tabs from './components/Tabs';
import Accordion from './components/Accordion';
import Button from './components/Button';
import NotificationPanel from './components/NotificationPanel';
import FormBuilder from './components/FormBuilder';
import CardList from './components/CardList';
import RecordViewer from './components/RecordViewer';
import CaseWidget from './components/widgets/CaseWidget';
import AdsWidget from './components/widgets/AdsWidget';
import ClientApplicationsWidget from './components/widgets/ClientApplicationsWidget';

const componentMap = {
    DataTable,
    RecordViewer,
    CardList,
    ClientApplicationsWidget,
    CaseWidget,
    AdsWidget,
    Tabs,
    Accordion,
    Button,
    FormBuilder,
    NotificationPanel
};

const UnknownComponent = ({ name }) => (
    <div className="kodi-dyn-missing">
        Component not found: <strong>{name}</strong>
    </div>
);

const buildRegistry = (components) => {
    if (!Array.isArray(components)) return new Map();
    const registry = new Map();

    for (const entry of components) {
        // Accept multiple shapes:
        // - { id, component_name }
        // - { id, name }
        // - { component: { id, name } }
        // - { componentId, componentName }
        const id = entry?.id || entry?.component?.id || entry?.componentId || entry?.component_id;
        const name = entry?.component_name
            || entry?.componentName
            || entry?.name
            || entry?.component?.name
            || entry?.component?.component_name
            || null;

        if (id && name) registry.set(String(id), name);
    }

    return registry;
};

const resolveComponentName = (slot, registry) => {
    if (!slot) return null;
    // Layout can store full component objects (builder), or a reference.
    return (
        slot.component_name
        || slot.componentName
        || slot.name
        || slot.component?.name
        || slot.component?.component_name
        || (slot.componentId != null ? registry?.get(String(slot.componentId)) : null)
        || (slot.component_id != null ? registry?.get(String(slot.component_id)) : null)
        || null
    );
};

const resolveProps = (slot) => {
    if (!slot) return {};
    return slot.props || slot.settings || {};
};

export const renderComponent = ({ componentName, props, context, events }) => {
    const Comp = componentMap[componentName];
    if (!Comp) return <UnknownComponent name={componentName} />;
    return <Comp props={props} context={context} events={events} />;
};

const DynamicRenderer = ({
    layout,
    components = null,
    context = {},
    events = {}
}) => {
    const rows = layout?.rows || [];
    const normalized = useMemo(() => (Array.isArray(rows) ? rows : []), [rows]);
    const registry = useMemo(() => buildRegistry(components), [components]);

    return (
        <div className="kodi-layout">
            {normalized.map((row, rowIndex) => (
                <div key={row.id || `row-${rowIndex}`} className="kodi-layout-row">
                    {(row.columns || []).map((col, colIndex) => (
                        <div
                            key={col.id || `col-${rowIndex}-${colIndex}`}
                            className="kodi-layout-col"
                            style={col.width ? { flex: `${col.width} 0 0` } : undefined}
                        >
                            {(col.components || []).map((slot, slotIndex) => {
                                const componentName = resolveComponentName(slot, registry);
                                if (!componentName) {
                                    return <UnknownComponent key={`slot-${slotIndex}`} name="(missing name)" />;
                                }
                                const props = resolveProps(slot);
                                return (
                                    <div key={slot.instanceId || `slot-${rowIndex}-${colIndex}-${slotIndex}`} className="kodi-layout-slot">
                                        {renderComponent({ componentName, props, context, events })}
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
};

export default DynamicRenderer;
