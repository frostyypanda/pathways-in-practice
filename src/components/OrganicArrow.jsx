import React from 'react';

const OrganicArrow = ({ width = 180, height = 24, color = "currentColor", style = {} }) => {
    const arrowHeadLength = 12;
    const arrowHeadWidth = 10; // Total width (5 up, 5 down from center)
    const lineEnd = width - arrowHeadLength;
    const midY = height / 2;

    return (
        <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={style}
        >
            {/* Main Line */}
            <line
                x1="0"
                y1={midY}
                x2={lineEnd}
                y2={midY}
                stroke={color}
                strokeWidth="2"
            />

            {/* Filled Arrow Head */}
            <path
                d={`M${lineEnd} ${midY - arrowHeadWidth / 2} L${width} ${midY} L${lineEnd} ${midY + arrowHeadWidth / 2} Z`}
                fill={color}
            />
        </svg>
    );
};

export default OrganicArrow;
