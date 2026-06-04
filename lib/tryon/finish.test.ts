import { finishStyle } from './finish';

describe('finishStyle', () => {
  it('matte → opaque multiply', () => {
    expect(finishStyle('matte')).toEqual({ opacity: 0.55, blendMode: 'multiply' });
  });
  it('satin → soft-light', () => {
    expect(finishStyle('satin')).toEqual({ opacity: 0.45, blendMode: 'soft-light' });
  });
  it('shimmer → screen', () => {
    expect(finishStyle('shimmer')).toEqual({ opacity: 0.4, blendMode: 'screen' });
  });
  it('is case-insensitive', () => {
    expect(finishStyle('MATTE').blendMode).toBe('multiply');
  });
  it('defaults for unknown or absent finish', () => {
    expect(finishStyle('glossy')).toEqual({ opacity: 0.45, blendMode: 'multiply' });
    expect(finishStyle(undefined)).toEqual({ opacity: 0.45, blendMode: 'multiply' });
  });
});
