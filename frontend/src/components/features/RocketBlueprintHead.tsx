import React from 'react';

interface RocketBlueprintHeadProps {
  isFinished?: boolean;
  isTesting?: boolean;
  className?: string;
}

/**
 * RocketBlueprintHead
 * A compact, vector-rendered 3D CAD wireframe blueprint of the Space Shuttle Orbiter,
 * styled to match the full-screen wireframe blueprint from slide 1b (CubeSpinner).
 * Rides at the leading head of the loading / progress bar.
 */
export const RocketBlueprintHead: React.FC<RocketBlueprintHeadProps> = ({
  isFinished = false,
  isTesting = true,
  className = '',
}) => {
  const strokeColor = isFinished ? '#34d399' : '#38bdf8';
  const glowColor = isFinished ? 'rgba(52, 211, 153, 0.8)' : 'rgba(56, 189, 248, 0.85)';
  const secondaryStroke = isFinished ? '#6ee7b7' : '#7dd3fc';

  return (
    <div
      className={`relative inline-flex items-center justify-center select-none pointer-events-none ${className}`}
      style={{
        filter: `drop-shadow(0 0 5px ${glowColor})`,
      }}
      title={isFinished ? 'Mission Complete' : 'Active Pipeline Progress'}
    >
      <svg
        width="46"
        height="24"
        viewBox="0 0 46 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="overflow-visible"
      >
        <defs>
          {/* Subtle cyan blueprint glow gradient */}
          <linearGradient id="rocketPlumeGrad" x1="100%" y1="50%" x2="0%" y2="50%">
            <stop offset="0%" stopColor={isFinished ? '#34d399' : '#38bdf8'} stopOpacity="0.95" />
            <stop offset="60%" stopColor={isFinished ? '#10b981' : '#0284c7'} stopOpacity="0.6" />
            <stop offset="100%" stopColor={isFinished ? '#059669' : '#0369a1'} stopOpacity="0" />
          </linearGradient>
          <linearGradient id="rocketPlumeCore" x1="100%" y1="50%" x2="0%" y2="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="70%" stopColor={isFinished ? '#a7f3d0' : '#bae6fd'} stopOpacity="0.8" />
            <stop offset="100%" stopColor={isFinished ? '#34d399' : '#38bdf8'} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* 1. SSME Engine Exhaust Thrust Plumes (trailing leftwards along the loading bar track) */}
        {isTesting && !isFinished && (
          <g className="animate-pulse" style={{ animationDuration: '650ms' }}>
            {/* Center Main Engine Plume */}
            <line
              x1="9.5"
              y1="12"
              x2="0.5"
              y2="12"
              stroke="url(#rocketPlumeGrad)"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
            <line
              x1="9.5"
              y1="12"
              x2="2.5"
              y2="12"
              stroke="url(#rocketPlumeCore)"
              strokeWidth="1.1"
              strokeLinecap="round"
            />

            {/* Upper Port Engine Plume */}
            <line
              x1="10.5"
              y1="9"
              x2="2.5"
              y2="9"
              stroke="url(#rocketPlumeGrad)"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
            <line
              x1="10.5"
              y1="9"
              x2="4"
              y2="9"
              stroke="url(#rocketPlumeCore)"
              strokeWidth="0.8"
              strokeLinecap="round"
            />

            {/* Lower Starboard Engine Plume */}
            <line
              x1="10.5"
              y1="15"
              x2="2.5"
              y2="15"
              stroke="url(#rocketPlumeGrad)"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
            <line
              x1="10.5"
              y1="15"
              x2="4"
              y2="15"
              stroke="url(#rocketPlumeCore)"
              strokeWidth="0.8"
              strokeLinecap="round"
            />
          </g>
        )}

        {/* 2. Dark Occlusion Silhouette (semi-translucent aerospace hull fill) */}
        <polygon
          points="
            43.5,12
            38,9.5
            28,9
            23,6
            14,2
            10.5,2
            12,8
            10,9
            10,15
            12,16
            10.5,22
            14,22
            23,18
            28,15
            38,14.5
          "
          fill="#060b14"
          fillOpacity="0.88"
        />

        {/* 3. Outer Hull & Double-Delta Wings (Electric Blueprint Lines) */}
        <polygon
          points="
            43.5,12
            38,9.5
            28,9
            23,6
            14,2
            10.5,2
            12,8
            10,9
            10,15
            12,16
            10.5,22
            14,22
            23,18
            28,15
            38,14.5
          "
          stroke={strokeColor}
          strokeWidth="1.1"
          strokeLinejoin="round"
        />

        {/* 4. Wing Elevon Trailing Edge Hinges & Internal Ribs */}
        {/* Port (Upper) Wing Ribs */}
        <line x1="23" y1="6" x2="11.5" y2="6" stroke={secondaryStroke} strokeWidth="0.75" strokeOpacity="0.8" />
        <line x1="12" y1="2" x2="11.5" y2="6" stroke={secondaryStroke} strokeWidth="0.7" strokeOpacity="0.7" />
        <line x1="14" y1="2" x2="12" y2="8" stroke={strokeColor} strokeWidth="0.8" strokeOpacity="0.6" />

        {/* Starboard (Lower) Wing Ribs */}
        <line x1="23" y1="18" x2="11.5" y2="18" stroke={secondaryStroke} strokeWidth="0.75" strokeOpacity="0.8" />
        <line x1="12" y1="22" x2="11.5" y2="18" stroke={secondaryStroke} strokeWidth="0.7" strokeOpacity="0.7" />
        <line x1="14" y1="22" x2="12" y2="16" stroke={strokeColor} strokeWidth="0.8" strokeOpacity="0.6" />

        {/* 5. Cylindrical Fuselage Bulkhead Station Rings */}
        <line x1="27" y1="9" x2="27" y2="15" stroke={strokeColor} strokeWidth="0.75" strokeOpacity="0.75" />
        <line x1="22" y1="9" x2="22" y2="15" stroke={secondaryStroke} strokeWidth="0.7" strokeOpacity="0.7" />
        <line x1="17" y1="9" x2="17" y2="15" stroke={secondaryStroke} strokeWidth="0.7" strokeOpacity="0.7" />
        <line x1="12" y1="9" x2="12" y2="15" stroke={strokeColor} strokeWidth="0.8" strokeOpacity="0.8" />

        {/* 6. Payload Bay Door Centerline Split Seam */}
        <line x1="35" y1="12" x2="10.5" y2="12" stroke={secondaryStroke} strokeWidth="0.85" strokeDasharray="1.8 1" />

        {/* 7. Vertical Stabilizer (Tail Fin) Blade along Aft Spine */}
        <line x1="19" y1="12" x2="8.5" y2="12" stroke={strokeColor} strokeWidth="1.3" />
        <line x1="16" y1="11" x2="8.5" y2="11" stroke={secondaryStroke} strokeWidth="0.65" strokeOpacity="0.7" />
        <line x1="16" y1="13" x2="8.5" y2="13" stroke={secondaryStroke} strokeWidth="0.65" strokeOpacity="0.7" />
        <line x1="8.5" y1="10.5" x2="8.5" y2="13.5" stroke={strokeColor} strokeWidth="0.9" />

        {/* 8. Cockpit Canopy & Forward Windshield Facets */}
        <path
          d="M 37.5 10.5 L 40.5 12 L 37.5 13.5 L 34.5 13.5 L 34.5 10.5 Z"
          stroke={secondaryStroke}
          strokeWidth="0.85"
          fill={isFinished ? 'rgba(52, 211, 153, 0.25)' : 'rgba(56, 189, 248, 0.3)'}
        />
        <line x1="37.5" y1="10.5" x2="37.5" y2="13.5" stroke={secondaryStroke} strokeWidth="0.7" />
        <line x1="40.5" y1="12" x2="43.5" y2="12" stroke={strokeColor} strokeWidth="0.9" />

        {/* 9. OMS Aft Shoulder Pods */}
        <path d="M 15 8 L 10.5 8" stroke={strokeColor} strokeWidth="0.85" />
        <path d="M 15 16 L 10.5 16" stroke={strokeColor} strokeWidth="0.85" />

        {/* 10. SSME Main Engine Bells (3 circular nozzle cups) */}
        {/* Center Engine Bell */}
        <ellipse cx="9.8" cy="12" rx="0.9" ry="1.2" stroke={strokeColor} strokeWidth="0.85" fill="#040810" />
        {/* Upper Engine Bell */}
        <ellipse cx="10.5" cy="9.2" rx="0.8" ry="1.1" stroke={strokeColor} strokeWidth="0.8" fill="#040810" />
        {/* Lower Engine Bell */}
        <ellipse cx="10.5" cy="14.8" rx="0.8" ry="1.1" stroke={strokeColor} strokeWidth="0.8" fill="#040810" />

        {/* Nose Tip Beacon / Sensor Pip */}
        <circle cx="43.5" cy="12" r="0.8" fill={strokeColor} />
      </svg>
    </div>
  );
};

export default RocketBlueprintHead;
