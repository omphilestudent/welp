// src/components/common/Loading.jsx
import React from 'react';

const Loading = ({ size = 'medium' }) => {
    const sizeClass = size === 'large' ? 'spinner-large' :
        size === 'small' ? 'spinner-small' : 'spinner';

    return (
        <div className="loading-container">
            <div className={sizeClass}></div>
        </div>
    );
};

export default Loading;