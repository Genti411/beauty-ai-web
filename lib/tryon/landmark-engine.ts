import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import type { ShadeData, TryOnEngine } from './engine';
import { NoFaceError, MultipleFacesError } from './engine';
import { regionPolygons, type Region } from './regions';
import { finishStyle } from './finish';

const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

export class LandmarkTryOnEngine implements TryOnEngine {
  private landmarkerPromise?: Promise<FaceLandmarker>;

  private getLandmarker(): Promise<FaceLandmarker> {
    if (!this.landmarkerPromise) {
      this.landmarkerPromise = (async () => {
        const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
        return FaceLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_URL },
          runningMode: 'IMAGE',
          numFaces: 2,
        });
      })();
    }
    return this.landmarkerPromise;
  }

  async applyLook(image: ImageBitmapSource, shades: ShadeData[]): Promise<Blob> {
    const bitmap = await createImageBitmap(image);
    const landmarker = await this.getLandmarker();
    const result = landmarker.detect(bitmap);

    if (!result.faceLandmarks || result.faceLandmarks.length === 0) throw new NoFaceError();
    if (result.faceLandmarks.length > 1) throw new MultipleFacesError();

    const landmarks = result.faceLandmarks[0];
    const { width, height } = bitmap;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas context unavailable');
    ctx.drawImage(bitmap, 0, 0);

    for (const shade of shades) {
      const polys = regionPolygons(shade.region as Region, landmarks, width, height);
      if (polys.length === 0) continue;
      const { opacity, blendMode } = finishStyle(shade.finish);
      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.globalCompositeOperation = blendMode;
      ctx.fillStyle = shade.hex;
      for (const poly of polys) {
        ctx.beginPath();
        poly.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas.toBlob failed'))), 'image/png'),
    );
  }
}
