/** Barrel du domaine « visage » (géométrie pure : contour, repères, ajustement des yeux). */
export { headOutline, outlinePath, rightSamples, halfWidthAt, minHalfWidth, type Outline } from './outline';
export { faceLandmarks, type FaceLandmarks, type LipLandmarks, type NeckLandmarks, type HairLandmarks, type ChinLandmarks, type JawLandmarks, type OrbitLandmarks } from './landmarks';
export { jawDerived, mouthOpenPx, type JawDerived } from './jaw/params';
export { lowerContour, type LowerContour } from './jaw/contour';
export { lerp, smooth, rotate, catmullRom, superEllipse, polylineLength, mirrorPoly } from './curve';
export { hairGeometry, type HairGeometry, type HairLock } from './hair';
export { facialHairGeometry, mustacheBand, type FacialHairGeometry } from './beard-geometry';
export { inPoly, polyArea, polyBox, type Poly } from './poly';
export { eyeReach, fitEyeToFace, type EyeFit, type EyeReach, type EyeSide, type EyeInput, type FitOptions } from './fit-eye';
export { noseGeometry, noseFrame, noseProfile, tipLift, type NoseGeometry, type NoseAlaGeo, type NostrilGeo, type NoseTipGeo, type NoseFrame, type NoseProfile } from './nose';
export { skinRegions, type Ellipse, type SkinRegions } from './regions';
export { earGeometry, type EarGeo } from './ears-geometry';
export { headPoly, chinPoly, jawline } from './jaw/regions';
