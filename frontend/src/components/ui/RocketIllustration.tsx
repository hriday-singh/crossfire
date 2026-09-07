import React from "react";
import { MechanicalBlueprintRocket } from "./MechanicalBlueprintRocket";

interface RocketIllustrationProps {
  className?: string;
  isThrusting?: boolean;
  scale?: number;
}

/**
 * 3D Mechanical Rocket Blueprint Component Wrapper
 */
export const RocketIllustration: React.FC<RocketIllustrationProps> = (props) => {
  return <MechanicalBlueprintRocket {...props} />;
};

export default RocketIllustration;
