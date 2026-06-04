import { pathFor } from './path';

describe('pathFor', () => {
  it('returns "<userId>/<lookId>.png"', () => {
    expect(pathFor('user-1', 'look-1')).toBe('user-1/look-1.png');
  });

  it('does not coerce the userId or lookId', () => {
    const path = pathFor('AAA-bbb', 'XYZ-123');
    expect(path).toBe('AAA-bbb/XYZ-123.png');
  });
});
