const { DEFAULT_LAYOUT } = require('./kodi.service');

const ensureColumns = (layout) => {
    if (!layout || typeof layout !== 'object') {
        return { ...DEFAULT_LAYOUT };
    }

    const normalized = { ...layout };
    if (!Array.isArray(normalized.columns)) {
        normalized.columns = DEFAULT_LAYOUT.columns;
    } else {
        normalized.columns = normalized.columns.map((col) => ({
            width: Number.isFinite(col.width) ? col.width : 12,
            components: Array.isArray(col.components) ? col.components : []
        }));
    }

    normalized.orientation = normalized.orientation || 'horizontal';
    normalized.type = normalized.type || '1-column';

    return normalized;
};

const layoutHasComponent = (layout) => {
    if (!layout || !Array.isArray(layout.columns)) return false;
    return layout.columns.some((col) => Array.isArray(col.components) && col.components.length > 0);
};

module.exports = {
    ensureColumns,
    layoutHasComponent
};
