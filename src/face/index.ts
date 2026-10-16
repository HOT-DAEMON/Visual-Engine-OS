/** Barrel du domaine « visage » (géométrie pure : contour, repères, ajustement des yeux). */
export { headOutline, outlinePath, rightSamples, halfWidthAt, minHalfWidth, type Outline } from './outline';
export { faceLandmarks, type FaceLandmarks, type LipLandmarks, type NeckLandmarks, type HairLandmarks } from './landmarks';
export { hairGeometry, type HairGeometry } from './hair-geometry';
export { facialHairGeometry, mustacheBand, type FacialHairGeometry } from './beard-geometry';
export { inPoly, polyArea, polyBox, type Poly } from './poly';
export { eyeReach, fitEyeToFace, type EyeFit, type EyeReach, type EyeSide, type EyeInput, type FitOptions } from './fit-eye';
