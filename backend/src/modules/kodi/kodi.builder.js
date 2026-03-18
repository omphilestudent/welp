const { DEFAULT_LAYOUT } = require('./kodi.service');

const ensureColumns = (layout) => {
    if (!layout || typeof layout !== 'object') {
        return { ...DEFAULT_LAYOUT };
    }

    const baseRows = Array.isArray(layout.rows) ? layout.rows : DEFAULT_LAYOUT.rows;
    const normalized = {
        ...DEFAULT_LAYOUT,
        ...layout,
        rows: baseRows.map((row, rowIndex) => {
            const rowColumns = Array.isArray(row.columns)
                ? row.columns
                : DEFAULT_LAYOUT.rows[rowIndex]?.columns || DEFAULT_LAYOUT.rows[0].columns;

            return {
                ...row,
                id: row.id || `row-${rowIndex}`,
                columns: rowColumns.map((col, colIndex) => ({
                    id: col.id || `col-${rowIndex}-${colIndex}`,
                    width: Number.isFinite(col.width) ? col.width : 12,
                    components: Array.isArray(col.components) ? col.components : []
                }))
            };
        })
    };

    normalized.orientation = normalized.orientation || DEFAULT_LAYOUT.orientation;
    normalized.type = normalized.type || DEFAULT_LAYOUT.type;

    return normalized;
};

const layoutHasComponent = (layout) => {
    if (!layout || !Array.isArray(layout.rows)) return false;
    return layout.rows.some((row) =>
        Array.isArray(row.columns) &&
        row.columns.some((col) => Array.isArray(col.components) && col.components.length > 0)
    );
};

module.exports = {
    ensureColumns,
    layoutHasComponent
};
