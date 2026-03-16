import React, { useState } from 'react';
import { resolveMediaUrl } from '../../utils/media';

const DEFAULT_AVATAR_URL = '/default-avatar.svg';

const AvatarImage = ({
    src,
    alt = 'Profile avatar',
    className = '',
    fallbackSrc = DEFAULT_AVATAR_URL,
    onError,
    ...rest
}) => {
    const [hasError, setHasError] = useState(false);
    const resolvedSrc = !src || hasError ? fallbackSrc : resolveMediaUrl(src);

    return (
        <img
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            {...rest}
            className={className}
            alt={alt}
            src={resolvedSrc}
            onError={(event) => {
                if (!hasError) {
                    setHasError(true);
                    event.currentTarget.src = fallbackSrc;
                }
                if (onError) {
                    onError(event);
                }
            }}
        />
    );
};

export default AvatarImage;
export { DEFAULT_AVATAR_URL };
