export type Region = 'lips' | 'eyes' | 'cheeks';
export type Landmark = { x: number; y: number };
export type Point = { x: number; y: number };

// MediaPipe FaceLandmarker (468-point face mesh) index loops per region.
// These are a reasonable STARTING set, refined during the manual visual step.
// Each region is one or more closed loops to fill as polygons.
export const REGION_INDICES: Record<Region, number[][]> = {
  // Outer lip contour loop.
  lips: [[61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185]],
  // Upper-lid contours, left then right eye.
  eyes: [
    [33, 246, 161, 160, 159, 158, 157, 173, 133, 155, 154, 153, 145, 144, 163, 7],
    [263, 466, 388, 387, 386, 385, 384, 398, 362, 382, 381, 380, 374, 373, 390, 249],
  ],
  // Cheek blobs, left then right.
  cheeks: [
    [50, 101, 118, 117, 123],
    [280, 330, 347, 346, 352],
  ],
};

// Returns pixel-space polygons for a region given NORMALIZED landmarks (0..1) and
// the image dimensions. Returns [] if landmarks are missing or too few for the
// configured indices (caller renders nothing for that region).
export function regionPolygons(
  region: Region,
  landmarks: Landmark[],
  width: number,
  height: number,
): Point[][] {
  if (!landmarks || landmarks.length === 0) return [];
  const loops = REGION_INDICES[region];
  const result: Point[][] = [];
  for (const loop of loops) {
    if (loop.some((i) => i >= landmarks.length)) return [];
    result.push(loop.map((i) => ({ x: landmarks[i].x * width, y: landmarks[i].y * height })));
  }
  return result;
}
