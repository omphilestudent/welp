import React from 'react';

const AppSettingsForm = ({ value, pages, onChange, onSubmit, saving }) => (
    <div className="kodi-portal-form">
        <label>
            App name
            <input
                type="text"
                value={value.name || ''}
                onChange={(e) => onChange({ ...value, name: e.target.value })}
            />
        </label>
        <label>
            App label
            <input
                type="text"
                value={value.label || ''}
                onChange={(e) => onChange({ ...value, label: e.target.value })}
            />
        </label>
        <label>
            Description
            <textarea
                rows={3}
                value={value.description || ''}
                onChange={(e) => onChange({ ...value, description: e.target.value })}
            />
        </label>
        <label>
            Icon URL
            <input
                type="text"
                value={value.icon || ''}
                onChange={(e) => onChange({ ...value, icon: e.target.value })}
            />
        </label>
        <label>
            Logo URL
            <input
                type="text"
                value={value.settings?.logoUrl || ''}
                onChange={(e) => onChange({ ...value, settings: { ...(value.settings || {}), logoUrl: e.target.value } })}
            />
        </label>
        <label>
            Navbar style
            <select
                value={value.settings?.navbarStyle || 'dark'}
                onChange={(e) => onChange({ ...value, settings: { ...(value.settings || {}), navbarStyle: e.target.value } })}
            >
                <option value="dark">dark</option>
                <option value="light">light</option>
            </select>
        </label>
        <label>
            Title display
            <select
                value={value.settings?.titleDisplay || 'full'}
                onChange={(e) => onChange({ ...value, settings: { ...(value.settings || {}), titleDisplay: e.target.value } })}
            >
                <option value="full">full</option>
                <option value="compact">compact</option>
            </select>
        </label>
        <label>
            Layout density
            <select
                value={value.settings?.layoutDensity || 'comfortable'}
                onChange={(e) => onChange({ ...value, settings: { ...(value.settings || {}), layoutDensity: e.target.value } })}
            >
                <option value="comfortable">comfortable</option>
                <option value="compact">compact</option>
            </select>
        </label>
        <div className="kodi-portal-form__grid">
            <label>
                Primary color
                <input
                    type="color"
                    value={value.themeConfig?.primaryColor || '#2563eb'}
                    onChange={(e) => onChange({ ...value, themeConfig: { ...(value.themeConfig || {}), primaryColor: e.target.value } })}
                />
            </label>
            <label>
                Accent color
                <input
                    type="color"
                    value={value.themeConfig?.accentColor || '#38bdf8'}
                    onChange={(e) => onChange({ ...value, themeConfig: { ...(value.themeConfig || {}), accentColor: e.target.value } })}
                />
            </label>
            <label>
                Surface color
                <input
                    type="color"
                    value={value.themeConfig?.surfaceColor || '#0b1120'}
                    onChange={(e) => onChange({ ...value, themeConfig: { ...(value.themeConfig || {}), surfaceColor: e.target.value } })}
                />
            </label>
            <label>
                Text color
                <input
                    type="color"
                    value={value.themeConfig?.textColor || '#e2e8f0'}
                    onChange={(e) => onChange({ ...value, themeConfig: { ...(value.themeConfig || {}), textColor: e.target.value } })}
                />
            </label>
        </div>
        <label>
            Background gradient
            <input
                type="text"
                placeholder="linear-gradient(135deg, #1d4ed8 0%, #3b82f6 45%, #0ea5e9 100%)"
                value={value.themeConfig?.backgroundGradient || ''}
                onChange={(e) => onChange({ ...value, themeConfig: { ...(value.themeConfig || {}), backgroundGradient: e.target.value } })}
            />
        </label>
        <label>
            Default page
            <select
                value={value.defaultPageId || ''}
                onChange={(e) => onChange({ ...value, defaultPageId: e.target.value })}
            >
                <option value="">Select default page</option>
                {pages.map((page) => (
                    <option key={page.page_id} value={page.page_id}>
                        {page.nav_label || page.label}
                    </option>
                ))}
            </select>
        </label>
        <label>
            Navigation mode
            <select
                value={value.navigationMode || 'sidebar'}
                onChange={(e) => onChange({ ...value, navigationMode: e.target.value })}
            >
                <option value="sidebar">sidebar</option>
                <option value="top">top</option>
                <option value="compact">compact</option>
            </select>
        </label>
        <label>
            Landing behavior
            <select
                value={value.landingBehavior || 'default_page'}
                onChange={(e) => onChange({ ...value, landingBehavior: e.target.value })}
            >
                <option value="default_page">default_page</option>
                <option value="last_visited">last_visited</option>
            </select>
        </label>
        <div className="kodi-portal-form__section">
            <h3>Utility bar</h3>
            <p className="kodi-portal-form__hint">
                Enable, rename, and order utilities shown in the runtime utility bar.
            </p>
            <div className="kodi-portal-utility-list">
                {(value.utilities || []).map((utility, index) => (
                    <div key={utility.utility_key || index} className="kodi-portal-utility-row">
                        <input
                            type="checkbox"
                            checked={utility.is_enabled !== false}
                            onChange={(e) => {
                                const next = [...(value.utilities || [])];
                                next[index] = { ...utility, is_enabled: e.target.checked };
                                onChange({ ...value, utilities: next });
                            }}
                        />
                        <input
                            type="text"
                            value={utility.label || ''}
                            onChange={(e) => {
                                const next = [...(value.utilities || [])];
                                next[index] = { ...utility, label: e.target.value };
                                onChange({ ...value, utilities: next });
                            }}
                            placeholder="Utility label"
                        />
                        <input
                            type="text"
                            value={utility.icon || ''}
                            onChange={(e) => {
                                const next = [...(value.utilities || [])];
                                next[index] = { ...utility, icon: e.target.value };
                                onChange({ ...value, utilities: next });
                            }}
                            placeholder="Icon key"
                        />
                        <div className="kodi-portal-utility-actions">
                            <button
                                type="button"
                                onClick={() => {
                                    if (index === 0) return;
                                    const next = [...(value.utilities || [])];
                                    [next[index - 1], next[index]] = [next[index], next[index - 1]];
                                    next.forEach((item, idx) => (item.nav_order = idx + 1));
                                    onChange({ ...value, utilities: next });
                                }}
                            >
                                ↑
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    const next = [...(value.utilities || [])];
                                    if (index >= next.length - 1) return;
                                    [next[index + 1], next[index]] = [next[index], next[index + 1]];
                                    next.forEach((item, idx) => (item.nav_order = idx + 1));
                                    onChange({ ...value, utilities: next });
                                }}
                            >
                                ↓
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
        <button className="btn-primary" onClick={onSubmit} disabled={saving}>
            {saving ? 'Saving...' : 'Save settings'}
        </button>
    </div>
);

export default AppSettingsForm;
