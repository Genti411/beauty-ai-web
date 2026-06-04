import { regionPolygons, REGION_INDICES, type Landmark } from './regions';

// 468 fake landmarks where landmark[i] = { x: i/1000, y: i/2000 }.
const landmarks: Landmark[] = Array.from({ length: 468 }, (_, i) => ({
  x: i / 1000,
  y: i / 2000,
}));

describe('regionPolygons', () => {
  it('returns one polygon for lips, scaled to pixel coordinates', () => {
    const polys = regionPolygons('lips', landmarks, 100, 200);
    expect(polys).toHaveLength(1);
    const firstIdx = REGION_INDICES.lips[0][0];
    expect(polys[0][0]).toEqual({ x: (firstIdx / 1000) * 100, y: (firstIdx / 2000) * 200 });
    expect(polys[0]).toHaveLength(REGION_INDICES.lips[0].length);
  });

  it('returns two polygons for eyes and for cheeks', () => {
    expect(regionPolygons('eyes', landmarks, 100, 100)).toHaveLength(2);
    expect(regionPolygons('cheeks', landmarks, 100, 100)).toHaveLength(2);
  });

  it('returns [] when landmarks are empty', () => {
    expect(regionPolygons('lips', [], 100, 100)).toEqual([]);
  });

  it('returns [] when landmarks are too few for the indices', () => {
    const few: Landmark[] = [{ x: 0, y: 0 }, { x: 0.1, y: 0.1 }];
    expect(regionPolygons('lips', few, 100, 100)).toEqual([]);
  });
});
