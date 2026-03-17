import React, { useMemo, useState } from 'react';

const getValue = (row, key) => {
    if (!row || !key) return '';
    const value = row[key];
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
};

export default function DataTable({ props = {} }) {
    const columns = Array.isArray(props.columns) ? props.columns : [];
    const rows = Array.isArray(props.data) ? props.data : [];
    const pageSize = Number(props.pageSize || 10);
    const [page, setPage] = useState(1);
    const [query, setQuery] = useState('');
    const [sort, setSort] = useState({ key: '', dir: 'asc' });

    const filtered = useMemo(() => {
        if (!query.trim()) return rows;
        const term = query.toLowerCase();
        return rows.filter((row) =>
            columns.some((col) => getValue(row, col).toLowerCase().includes(term))
        );
    }, [rows, columns, query]);

    const sorted = useMemo(() => {
        if (!sort.key) return filtered;
        const dir = sort.dir === 'desc' ? -1 : 1;
        return [...filtered].sort((a, b) => {
            const av = getValue(a, sort.key);
            const bv = getValue(b, sort.key);
            return av.localeCompare(bv) * dir;
        });
    }, [filtered, sort]);

    const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
    const clampedPage = Math.min(totalPages, Math.max(1, page));
    const start = (clampedPage - 1) * pageSize;
    const visible = sorted.slice(start, start + pageSize);

    if (!columns.length) {
        return <div className="kodi-comp-empty">DataTable: missing `columns`.</div>;
    }

    return (
        <div className="kodi-comp kodi-table">
            <div className="kodi-table__top">
                <div className="kodi-table__title">{props.title || 'Table'}</div>
                <input
                    className="kodi-input"
                    placeholder="Search…"
                    value={query}
                    onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                />
            </div>
            <div className="kodi-table__wrap">
                <table>
                    <thead>
                        <tr>
                            {columns.map((col) => (
                                <th
                                    key={col}
                                    onClick={() => setSort((prev) => ({
                                        key: col,
                                        dir: prev.key === col && prev.dir === 'asc' ? 'desc' : 'asc'
                                    }))}
                                    style={{ cursor: 'pointer' }}
                                >
                                    {col}{sort.key === col ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {visible.map((row, idx) => (
                            <tr key={row.id || idx}>
                                {columns.map((col) => (
                                    <td key={col}>{getValue(row, col)}</td>
                                ))}
                            </tr>
                        ))}
                        {visible.length === 0 && (
                            <tr>
                                <td colSpan={columns.length} style={{ opacity: 0.75, padding: 14 }}>
                                    No rows
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            <div className="kodi-table__pager">
                <button className="btn btn-secondary btn-small" disabled={clampedPage <= 1} onClick={() => setPage(1)}>
                    First
                </button>
                <button className="btn btn-secondary btn-small" disabled={clampedPage <= 1} onClick={() => setPage(clampedPage - 1)}>
                    Prev
                </button>
                <span className="kodi-table__page">Page {clampedPage} / {totalPages}</span>
                <button className="btn btn-secondary btn-small" disabled={clampedPage >= totalPages} onClick={() => setPage(clampedPage + 1)}>
                    Next
                </button>
                <button className="btn btn-secondary btn-small" disabled={clampedPage >= totalPages} onClick={() => setPage(totalPages)}>
                    Last
                </button>
            </div>
        </div>
    );
}

export const config = {
    name: 'DataTable',
    props: [
        { name: 'title', type: 'string' },
        { name: 'columns', type: 'array', required: true },
        { name: 'data', type: 'array' },
        { name: 'pageSize', type: 'number' }
    ],
    editable: true
};

