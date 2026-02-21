import React from 'react';

export default function Flag({ code, size = 28, fallback = '🏁', style = {} }) {
    if (!code) {
        return <span style={{ fontSize: size * 0.8, ...style }}>{fallback}</span>;
    }

    const lowerCode = code.toLowerCase();

    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: size, height: size * 0.75, ...style }}>
            <img
                src={`https://flagcdn.com/w40/${lowerCode}.png`}
                width={size}
                alt={code}
                style={{
                    borderRadius: 2,
                    objectFit: 'cover'
                }}
                onError={(e) => {
                    e.target.style.display = 'none';
                    if (e.target.parentNode) {
                        e.target.parentNode.innerHTML = `<span style="font-size: ${size * 0.8}px">${fallback}</span>`;
                    }
                }}
            />
        </span>
    );
}
