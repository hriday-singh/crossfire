import React from "react";

interface MechanicalBlueprintRocketProps {
  className?: string;
  isThrusting?: boolean;
  scale?: number;
}

/**
 * 3D Mechanical Rocket Blueprint Component
 * 
 * Features:
 * - High-precision CAD / Blueprint aesthetic with technical cyan & electric blue lines
 * - Isometric 3D mechanical cutaways (avionics bay, pressurized fuel tanks, turbopump, gimbal assembly)
 * - 3D structural lattice ribs, cross-section fuselage rings, and panel fasteners
 * - Digital blueprint vector thruster with CAD shock rings and technical exhaust plume
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
          {/* Technical Blueprint Glow and Gradients */}
          <linearGradient id="bpBodyGradient" x1="60" y1="130" x2="440" y2="130" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#031525" stopOpacity="0.88" />
            <stop offset="50%" stopColor="#082f49" stopOpacity="0.85" />
            <stop offset="85%" stopColor="#0c4a6e" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#0369a1" stopOpacity="0.9" />
          </linearGradient>

          <linearGradient id="bpInternalGradient" x1="120" y1="130" x2="380" y2="130" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0284c7" stopOpacity="0.25" />
            <stop offset="50%" stopColor="#38bdf8" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#0284c7" stopOpacity="0.15" />
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

          <pattern id="bpGridPattern" width="12" height="12" patternUnits="userSpaceOnUse">
            <path d="M 12 0 L 0 0 0 12" fill="none" stroke="#0284c7" strokeWidth="0.5" strokeOpacity="0.35" />
          </pattern>

          <pattern id="bpHatchPattern" width="8" height="8" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="0" y2="8" stroke="#38bdf8" strokeWidth="0.75" strokeOpacity="0.4" />
          </pattern>
        </defs>

        {/* CAD Telemetry Label */}
        <text x="60" y="30" fill="#38bdf8" fontSize="8" fontFamily="monospace" letterSpacing="1">
          CAD STAGE-01
        </text>

        {/* ================= BLUEPRINT THRUSTER ENERGY & VECTOR JETS ================= */}
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

            {/* Hyper-Energy Centerline Vector */}
            <line x1="94" y1="130" x2="-65" y2="130" stroke="#ffffff" strokeWidth="2.5" strokeDasharray="12 4" />

            {/* CAD Shock Diamond Rings / Telemetry Pulse Circles */}
            <g stroke="#38bdf8" strokeWidth="1.2" fill="none">
              <ellipse cx="60" cy="130" rx="6" ry="18" strokeDasharray="3 2" />
              <ellipse cx="25" cy="130" rx="5" ry="14" />
              <ellipse cx="-10" cy="130" rx="4" ry="10" strokeDasharray="2 2" />
              <ellipse cx="-45" cy="130" rx="3" ry="6" />
            </g>

            {/* Blueprint Vector Field Arrows */}
            <line x1="88" y1="106" x2="35" y2="114" stroke="#60a5fa" strokeWidth="1" strokeDasharray="4 2" />
            <line x1="88" y1="154" x2="35" y2="146" stroke="#60a5fa" strokeWidth="1" strokeDasharray="4 2" />
          </g>
        )}

        {/* ================= AERODYNAMIC BLUEPRINT FINS (3D PERSPECTIVE) ================= */}
        {/* Top Fin (Orthographic 3D Projection) */}
        <g>
          <path
            d="M 195 86 L 95 24 C 85 18, 72 26, 76 38 L 92 86 Z"
            fill="#082f49"
            fillOpacity="0.75"
            stroke="#38bdf8"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path d="M 195 86 L 95 24 L 92 86 Z" fill="url(#bpHatchPattern)" />
          {/* Internal Structural Stringers */}
          <line x1="120" y1="42" x2="118" y2="86" stroke="#38bdf8" strokeWidth="1" strokeDasharray="2 2" opacity="0.8" />
          <line x1="155" y1="62" x2="152" y2="86" stroke="#38bdf8" strokeWidth="1" strokeDasharray="2 2" opacity="0.8" />
        </g>

        {/* Bottom Fin (Orthographic 3D Projection) */}
        <g>
          <path
            d="M 195 174 L 95 236 C 85 242, 72 234, 76 222 L 92 174 Z"
            fill="#082f49"
            fillOpacity="0.75"
            stroke="#38bdf8"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path d="M 195 174 L 95 236 L 92 174 Z" fill="url(#bpHatchPattern)" />
          <line x1="120" y1="218" x2="118" y2="174" stroke="#38bdf8" strokeWidth="1" strokeDasharray="2 2" opacity="0.8" />
          <line x1="155" y1="198" x2="152" y2="174" stroke="#38bdf8" strokeWidth="1" strokeDasharray="2 2" opacity="0.8" />
        </g>

        {/* ================= MECHANICAL TURBOPUMP & NOZZLE ASSEMBLY ================= */}
        {/* Engine Bell Conical Nozzle */}
        <path
          d="M 98 94 L 64 100 C 58 102, 54 106, 54 112 L 54 148 C 54 154, 58 158, 64 160 L 98 166 Z"
          fill="#031d33"
          stroke="#38bdf8"
          strokeWidth="2"
        />
        {/* Nozzle Regenerative Cooling Spirals */}
        <path d="M 68 104 C 64 112, 64 148, 68 156" stroke="#67e8f9" strokeWidth="1.5" />
        <path d="M 80 98 C 76 110, 76 150, 80 162" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="4 2" />

        {/* Hydraulic Gimbal Actuator Cylinders */}
        <rect x="88" y="88" width="18" height="6" rx="2" fill="#0284c7" stroke="#38bdf8" strokeWidth="1" />
        <rect x="88" y="166" width="18" height="6" rx="2" fill="#0284c7" stroke="#38bdf8" strokeWidth="1" />

        {/* ================= FUSELAGE / MECHANICAL CUTAWAY HULL ================= */}
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

        {/* CAD Blueprint Grid Fill Inside Fuselage */}
        <path
          d="M 94 86 
             C 170 85, 290 92, 385 116 
             C 415 123, 442 130, 442 130 
             C 442 130, 415 137, 385 144 
             C 290 168, 170 175, 94 174 
             Z"
          fill="url(#bpGridPattern)"
          opacity="0.45"
        />

        {/* Upper Specular Laser Horizon */}
        <path
          d="M 102 92 C 172 90, 288 97, 382 120"
          stroke="url(#bpLaserHighlight)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        {/* ================= MECHANICAL CUTAWAYS & 3D ISOMETRIC BULKHEADS ================= */}
        {/* Stage 1: Liquid Oxygen Tank (Cross-Section Cutaway) */}
        <g>
          <ellipse cx="155" cy="130" rx="9" ry="40" fill="none" stroke="#38bdf8" strokeWidth="1.5" />
          <ellipse cx="155" cy="130" rx="9" ry="40" fill="url(#bpHatchPattern)" opacity="0.35" />
          {/* Cryogenic Piping */}
          <line x1="120" y1="130" x2="220" y2="130" stroke="#67e8f9" strokeWidth="2" strokeDasharray="6 3" />
          <text x="140" y="105" fill="#7dd3fc" fontSize="7" opacity="0.8">
            LOX TANK
          </text>
        </g>

        {/* Interstage Ring Bulkhead (3D Ring) */}
        <g>
          <ellipse cx="230" cy="130" rx="10" ry="38" fill="#082f49" fillOpacity="0.6" stroke="#38bdf8" strokeWidth="2" />
          <line x1="230" y1="92" x2="230" y2="168" stroke="#38bdf8" strokeWidth="1.2" strokeDasharray="3 2" />
        </g>

        {/* Stage 2: Kerosene RP-1 Fuel Tank */}
        <g>
          <ellipse cx="295" cy="130" rx="10" ry="34" fill="none" stroke="#38bdf8" strokeWidth="1.5" />
          <ellipse cx="295" cy="130" rx="10" ry="34" fill="url(#bpHatchPattern)" opacity="0.25" />
          <text x="280" y="105" fill="#7dd3fc" fontSize="7" opacity="0.8">
            RP-1 CELL
          </text>
        </g>

        {/* Forward Bulkhead & Avionics Bay */}
        <g>
          <ellipse cx="360" cy="130" rx="9" ry="26" fill="none" stroke="#38bdf8" strokeWidth="1.8" />
          <circle cx="360" cy="130" r="4" fill="#38bdf8" opacity="0.8" />
          <line x1="360" y1="104" x2="360" y2="156" stroke="#38bdf8" strokeWidth="1" strokeDasharray="2 2" />
        </g>

        {/* 3D Longitudinal Structural Stringer Lines */}
        <path d="M 96 108 C 172 107, 288 113, 380 126" stroke="#0284c7" strokeWidth="1.2" strokeDasharray="6 3" />
        <path d="M 96 152 C 172 153, 288 147, 380 134" stroke="#0284c7" strokeWidth="1.2" strokeDasharray="6 3" />

        {/* Fastener / Rivet Rows (CAD Technical Cross Markers) */}
        <g stroke="#38bdf8" strokeWidth="0.8">
          {[125, 175, 205, 255, 275, 325, 345].map((x) => (
            <React.Fragment key={x}>
              <line x1={x - 2} y1={94} x2={x + 2} y2={94} />
              <line x1={x} y1={92} x2={x} y2={96} />
              <line x1={x - 2} y1={166} x2={x + 2} y2={166} />
              <line x1={x} y1={164} x2={x} y2={168} />
            </React.Fragment>
          ))}
        </g>

        {/* ================= NOSE CONE AVIONICS & RADAR SENSOR DOME ================= */}
        <g>
          {/* Nose Cap */}
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

          {/* Radar Target Crosshair / Guidance Reticle */}
          <circle cx="410" cy="130" r="7" stroke="#38bdf8" strokeWidth="1" strokeDasharray="2 2" fill="none" />
          <circle cx="410" cy="130" r="2.5" fill="#38bdf8" />
          <line x1="400" y1="130" x2="420" y2="130" stroke="#38bdf8" strokeWidth="0.8" />
          <line x1="410" y1="120" x2="410" y2="140" stroke="#38bdf8" strokeWidth="0.8" />
        </g>

        {/* ================= CENTER DORSAL FIN (3D AXIS ISOMETRIC) ================= */}
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
