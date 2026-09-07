import React from "react";

interface MechanicalBlueprintRocketProps {
  className?: string;
  isThrusting?: boolean;
  scale?: number;
}

/**
 * 3D Mechanical Rocket Component
 * Cleaned version - pure rocket, no technical blueprint/HUD annotations
 */
export const MechanicalBlueprintRocket: React.FC<MechanicalBlueprintRocketProps> = ({
  className = "",
  isThrusting = true,
  scale = 1,
}) => {
  return (
    <div
      className={`relative select-none pointer-events-none ${className}`}
      style={{
        transform: `scale(${scale})`,
        transformOrigin: "center center",
      }}
    >
      <svg
        viewBox="0 0 540 260"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full filter drop-shadow-[0_0_24px_rgba(56,189,248,0.35)]"
      >
        <defs>
          <linearGradient id="bpBodyGradient" x1="60" y1="130" x2="440" y2="130" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#031525" stopOpacity="0.88" />
            <stop offset="50%" stopColor="#082f49" stopOpacity="0.85" />
            <stop offset="85%" stopColor="#0c4a6e" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#0369a1" stopOpacity="0.9" />
          </linearGradient>

          <linearGradient id="bpFlameGrad" x1="90" y1="130" x2="-40" y2="130" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.95" />
            <stop offset="35%" stopColor="#60a5fa" stopOpacity="0.85" />
            <stop offset="70%" stopColor="#818cf8" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#c084fc" stopOpacity="0" />
          </linearGradient>

          <linearGradient id="bpLaserHighlight" x1="100" y1="70" x2="420" y2="70" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.2" />
            <stop offset="50%" stopColor="#bae6fd" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.4" />
          </linearGradient>
        </defs>

        {/* ================= BLUEPRINT THRUSTER ENERGY ================= */}
        {isThrusting && (
          <g className="blueprint-flame-group">
            {/* Outer CAD Flame Envelope */}
            <path
              d="M 94 98 C 45 98, -10 112, -75 130 C -10 148, 45 162, 94 162 Z"
              fill="url(#bpFlameGrad)"
              opacity="0.85"
            />
            {/* Inner Blueprint Jet Core */}
            <path
              d="M 94 108 C 55 108, 10 118, -35 130 C 10 142, 55 152, 94 152 Z"
              fill="#e0f2fe"
              opacity="0.9"
            />
            {/* Centerline Vector */}
            <line x1="94" y1="130" x2="-65" y2="130" stroke="#ffffff" strokeWidth="2.5" strokeDasharray="12 4" />
          </g>
        )}

        {/* ================= AERODYNAMIC FINS ================= */}
        {/* Top Fin */}
        <path
          d="M 195 86 L 95 24 C 85 18, 72 26, 76 38 L 92 86 Z"
          fill="#082f49"
          fillOpacity="0.75"
          stroke="#38bdf8"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />

        {/* Bottom Fin */}
        <path
          d="M 195 174 L 95 236 C 85 242, 72 234, 76 222 L 92 174 Z"
          fill="#082f49"
          fillOpacity="0.75"
          stroke="#38bdf8"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />

        {/* ================= NOZZLE ASSEMBLY ================= */}
        {/* Engine Bell Conical Nozzle */}
        <path
          d="M 98 94 L 64 100 C 58 102, 54 106, 54 112 L 54 148 C 54 154, 58 158, 64 160 L 98 166 Z"
          fill="#031d33"
          stroke="#38bdf8"
          strokeWidth="2"
        />

        {/* Gimbal Actuator Cylinders */}
        <rect x="88" y="88" width="18" height="6" rx="2" fill="#0284c7" stroke="#38bdf8" strokeWidth="1" />
        <rect x="88" y="166" width="18" height="6" rx="2" fill="#0284c7" stroke="#38bdf8" strokeWidth="1" />

        {/* ================= FUSELAGE HULL ================= */}
        {/* Outer Hull Contour Path */}
        <path
          d="M 94 86 
             C 170 85, 290 92, 385 116 
             C 415 123, 442 130, 442 130 
             C 442 130, 415 137, 385 144 
             C 290 168, 170 175, 94 174 
             Z"
          fill="url(#bpBodyGradient)"
          stroke="#38bdf8"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />

        {/* Upper Specular Laser Horizon */}
        <path
          d="M 102 92 C 172 90, 288 97, 382 120"
          stroke="url(#bpLaserHighlight)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        {/* ================= NOSE CONE ================= */}
        <path
          d="M 370 119 
             C 395 125, 420 128, 442 130 
             C 420 132, 395 135, 370 141 
             C 376 134, 376 126, 370 119 
             Z"
          fill="#0284c7"
          fillOpacity="0.4"
          stroke="#67e8f9"
          strokeWidth="1.8"
        />

        {/* ================= CENTER DORSAL FIN ================= */}
        <path
          d="M 175 130 L 85 118 C 78 116, 75 124, 78 128 L 85 130 L 78 132 C 75 136, 78 144, 85 142 L 175 130 Z"
          fill="#0c4a6e"
          fillOpacity="0.85"
          stroke="#67e8f9"
          strokeWidth="1.5"
        />
      </svg>
    </div>
  );
};

export default MechanicalBlueprintRocket;
