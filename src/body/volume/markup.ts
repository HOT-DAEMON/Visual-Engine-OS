import { memoPure } from '../../perf';
import { BodyParams, type BodyInput, type NeckAnchor } from '../types';
import { bodyVolumes } from './build';
import { VolumeParams, type VolumeInput } from './params';
import { renderVolumes, type VMarkup, type VRenderOpts } from './render';

const run = (bp: BodyParams, a: NeckAnchor, vp: VolumeParams, o: VRenderOpts): VMarkup => renderVolumes(bodyVolumes(bp, a, vp), o);
const memo = memoPure('body-volume-svg', 'svg', run, 128);
/** SVG des volumes, mémoïsé par le CONTENU (corps + ancre + 3D + options dont la caméra) : un point de vue déjà rendu ne coûte plus rien ; un nouveau point de vue ne recalcule QUE la projection. */
export const volumeMarkup = (raw: BodyInput, a: NeckAnchor, vp: VolumeInput, o: VRenderOpts): VMarkup => memo(BodyParams.parse(raw), a, VolumeParams.parse(vp), o);
