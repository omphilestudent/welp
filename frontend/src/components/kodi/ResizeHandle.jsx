import React, { useRef } from 'react';

const ResizeHandle = ({ direction = 'both', onResizeStart }) => {
    const startRef = useRef(null);

    const onMouseDown = (event) => {
        event.preventDefault();
        event.stopPropagation();
        const start = { x: event.clientX, y: event.clientY };
        startRef.current = start;
        if (onResizeStart) {
            onResizeStart(start);
        }
    };

    return (
        <div
            className={`kodi-resize-handle kodi-resize-handle--${direction}`}
            onMouseDown={onMouseDown}
            role="presentation"
        />
    );
};

export default ResizeHandle;
