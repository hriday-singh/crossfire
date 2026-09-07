/**
 * Sprite Configurations for Crossfire Evaluator Bots and Crucible Arbiter
 * Defines spritesheet asset URLs, frame slicing rectangles, and scaling.
 * 
 * Each sheet contains:
 * - 10 Walk Frames (Row 1 & Row 2)
 * - 8 Turn Frames (Row 3):
 *     0: Front (South)
 *     1: 3/4 Front-Right
 *     2: Right Profile (East)
 *     3: 3/4 Back-Right
 *     4: Back View (North)  <-- Back view of bot for top desks/stations
 *     5: 3/4 Back-Left
 *     6: Left Profile (West)
 *     7: 3/4 Front-Left
 */

export const BOT_SPRITE_CONFIGS = {
  devils_advocate: {
    assetUrl: '/devil_thing.webp',
    scale: 0.5,
    walkBounds: [
      { x: 15, y: 78, w: 180, h: 210 },
      { x: 210, y: 78, w: 180, h: 210 },
      { x: 415, y: 78, w: 180, h: 210 },
      { x: 590, y: 78, w: 190, h: 210 },
      { x: 790, y: 78, w: 185, h: 210 },
      { x: 20, y: 375, w: 165, h: 212 },
      { x: 180, y: 375, w: 170, h: 212 },
      { x: 345, y: 375, w: 155, h: 212 },
      { x: 495, y: 375, w: 155, h: 212 },
      { x: 650, y: 375, w: 155, h: 212 },
    ],
    turnBounds: [
      { x: 10, y: 738, w: 120, h: 186 },
      { x: 128, y: 738, w: 122, h: 186 },
      { x: 250, y: 738, w: 120, h: 186 },
      { x: 368, y: 738, w: 122, h: 186 },
      { x: 488, y: 738, w: 122, h: 186 }, // 4: Back View
      { x: 608, y: 738, w: 122, h: 186 },
      { x: 728, y: 738, w: 122, h: 186 },
      { x: 848, y: 738, w: 142, h: 186 },
    ],
  },
  operator: {
    assetUrl: '/operator_thing.webp',
    scale: 0.5,
    walkBounds: [
      { x: 35, y: 75, w: 180, h: 215 },
      { x: 225, y: 75, w: 180, h: 215 },
      { x: 425, y: 75, w: 180, h: 215 },
      { x: 635, y: 75, w: 180, h: 215 },
      { x: 835, y: 75, w: 180, h: 215 },
      { x: 65, y: 370, w: 160, h: 205 },
      { x: 225, y: 370, w: 160, h: 205 },
      { x: 385, y: 370, w: 160, h: 205 },
      { x: 540, y: 370, w: 160, h: 205 },
      { x: 690, y: 370, w: 160, h: 205 },
    ],
    turnBounds: [
      { x: 35, y: 700, w: 120, h: 195 },
      { x: 155, y: 700, w: 120, h: 195 },
      { x: 275, y: 700, w: 120, h: 195 },
      { x: 395, y: 700, w: 120, h: 195 },
      { x: 515, y: 700, w: 120, h: 195 }, // 4: Back View
      { x: 640, y: 700, w: 120, h: 195 },
      { x: 755, y: 700, w: 120, h: 195 },
      { x: 875, y: 700, w: 120, h: 195 },
    ],
  },
  builder: {
    assetUrl: '/builder_thing.webp',
    scale: 0.5,
    walkBounds: [
      { x: 39, y: 68, w: 194, h: 232 },
      { x: 238, y: 68, w: 186, h: 232 },
      { x: 428, y: 68, w: 193, h: 232 },
      { x: 625, y: 68, w: 220, h: 232 },
      { x: 852, y: 68, w: 168, h: 232 },
      { x: 39, y: 375, w: 180, h: 210 },
      { x: 223, y: 375, w: 161, h: 210 },
      { x: 389, y: 375, w: 142, h: 210 },
      { x: 535, y: 375, w: 144, h: 210 },
      { x: 683, y: 375, w: 165, h: 210 },
    ],
    turnBounds: [
      { x: 25, y: 715, w: 120, h: 200 },
      { x: 148, y: 715, w: 120, h: 200 },
      { x: 272, y: 715, w: 115, h: 200 },
      { x: 390, y: 715, w: 115, h: 200 },
      { x: 506, y: 715, w: 120, h: 200 }, // 4: Back View
      { x: 630, y: 715, w: 115, h: 200 },
      { x: 750, y: 715, w: 124, h: 200 },
      { x: 880, y: 715, w: 124, h: 200 },
    ],
  },
  receipts: {
    assetUrl: '/researcher_thing.webp',
    scale: 0.5,
    walkBounds: [
      { x: 34, y: 95, w: 170, h: 200 },
      { x: 234, y: 95, w: 185, h: 200 },
      { x: 430, y: 95, w: 175, h: 200 },
      { x: 620, y: 95, w: 185, h: 200 },
      { x: 835, y: 95, w: 170, h: 200 },
      { x: 45, y: 375, w: 160, h: 198 },
      { x: 210, y: 375, w: 155, h: 198 },
      { x: 370, y: 375, w: 150, h: 198 },
      { x: 530, y: 375, w: 155, h: 198 },
      { x: 690, y: 375, w: 155, h: 198 },
    ],
    turnBounds: [
      { x: 31, y: 696, w: 125, h: 194 },
      { x: 165, y: 696, w: 115, h: 194 },
      { x: 287, y: 696, w: 105, h: 194 },
      { x: 409, y: 696, w: 105, h: 194 },
      { x: 520, y: 696, w: 120, h: 194 }, // 4: Back View
      { x: 650, y: 696, w: 105, h: 194 },
      { x: 763, y: 696, w: 115, h: 194 },
      { x: 885, y: 696, w: 125, h: 194 },
    ],
  },
  judge: {
    assetUrl: '/judge_thing.webp',
    scale: 0.5,
    walkBounds: [
      { x: 50, y: 66, w: 165, h: 202 },
      { x: 250, y: 66, w: 165, h: 202 },
      { x: 440, y: 66, w: 165, h: 202 },
      { x: 635, y: 66, w: 165, h: 202 },
      { x: 860, y: 66, w: 160, h: 202 },
      { x: 45, y: 354, w: 160, h: 202 },
      { x: 200, y: 354, w: 160, h: 202 },
      { x: 365, y: 354, w: 160, h: 202 },
      { x: 525, y: 354, w: 160, h: 202 },
      { x: 665, y: 354, w: 160, h: 202 },
    ],
    turnBounds: [
      { x: 25, y: 687, w: 120, h: 198 },
      { x: 150, y: 687, w: 115, h: 198 },
      { x: 275, y: 687, w: 115, h: 198 },
      { x: 405, y: 687, w: 110, h: 198 },
      { x: 520, y: 687, w: 115, h: 198 }, // 4: Back View
      { x: 645, y: 687, w: 110, h: 198 },
      { x: 760, y: 687, w: 115, h: 198 },
      { x: 885, y: 687, w: 120, h: 198 },
    ],
  },
};

// Aliases
BOT_SPRITE_CONFIGS.researcher = BOT_SPRITE_CONFIGS.receipts;
BOT_SPRITE_CONFIGS.arbiter = BOT_SPRITE_CONFIGS.judge;
BOT_SPRITE_CONFIGS.agent_1 = BOT_SPRITE_CONFIGS.devils_advocate;
BOT_SPRITE_CONFIGS.agent_2 = BOT_SPRITE_CONFIGS.receipts;
BOT_SPRITE_CONFIGS.agent_3 = BOT_SPRITE_CONFIGS.builder;
BOT_SPRITE_CONFIGS.agent_4 = BOT_SPRITE_CONFIGS.operator;

/**
 * Returns the sprite configuration for an agent ID, defaulting to devils_advocate.
 * @param {string} agentId
 */
export function getSpriteConfig(agentId) {
  if (!agentId) return BOT_SPRITE_CONFIGS.devils_advocate;
  return BOT_SPRITE_CONFIGS[agentId] || BOT_SPRITE_CONFIGS.devils_advocate;
}

export default BOT_SPRITE_CONFIGS;
