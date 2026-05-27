import type { ShadeData } from '@/lib/catalog/types';

export type { ShadeData };

export interface TryOnEngine {
  // Applies the given shades to a face in the image; returns a PNG Blob.
  applyLook(image: ImageBitmapSource, shades: ShadeData[]): Promise<Blob>;
}

export class NoFaceError extends Error {
  constructor() {
    super('No face detected');
    this.name = 'NoFaceError';
  }
}

export class MultipleFacesError extends Error {
  constructor() {
    super('Multiple faces detected');
    this.name = 'MultipleFacesError';
  }
}
