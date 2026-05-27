export type FinishStyle = {
  opacity: number;
  blendMode: GlobalCompositeOperation;
};

// Maps a product finish to a canvas blend mode + opacity so the shade reads as
// makeup over skin rather than a flat sticker.
export function finishStyle(finish?: string): FinishStyle {
  switch ((finish ?? '').toLowerCase()) {
    case 'matte':
      return { opacity: 0.55, blendMode: 'multiply' };
    case 'satin':
      return { opacity: 0.45, blendMode: 'soft-light' };
    case 'shimmer':
      return { opacity: 0.4, blendMode: 'screen' };
    default:
      return { opacity: 0.45, blendMode: 'multiply' };
  }
}
