import React from 'react';

export default function CustomCodeWidget({ props = {} }) {
    const language = props.language || 'JS';
    const code = props.code || '// custom code';
    const preview = props.preview_enabled !== false;
    const execute = props.execute_action || 'run';

    return (
        <div className="custom-code-widget">
            <div className="custom-code-header">
                <strong>Custom {language}</strong>
                <span>{preview ? 'Preview enabled' : 'Preview off'}</span>
            </div>
            <pre className="custom-code-body">
                {code}
            </pre>
            <div className="custom-code-footer">
                <button type="button">{`Execute (${execute})`}</button>
            </div>
        </div>
    );
}
