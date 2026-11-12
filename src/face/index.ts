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
export { noseArchetype, noseArchetypeResidual, NOSE_ARCHETYPE_NAMES, REPRODUCIBLE_MAX, widthProfile25, type NoseArchetypeName, type WidthProfile } from './nose';
export { noseGeometry, noseFrame, noseProfile, tipLift, type NoseGeometry, type NoseAlaGeo, type NostrilGeo, type NoseTipGeo, type NoseFrame, type NoseProfile } from './nose';
export { skinRegions, type Ellipse, type SkinRegions } from './regions';
export { earGeometry, earEngine, type EarGeo } from './ears-geometry';
export { headPoly, chinPoly, jawline } from './jaw/regions';
export { facePerimeters, eyeBands, browGapPerEye, type FacePerimeters, type Perimeter, type PerimeterId, type EyeBands } from './perimeters';
export { PERIMETER_LIMITS, PERIMETER_RATIOS, BROW_GAP } from './perimeters-limits';
