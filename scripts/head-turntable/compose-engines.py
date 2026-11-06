"""Assemble les gros plans et l'avant/après : ear_sheet, jaw_sheet, avant_apres_{045,090,135}."""
import os, subprocess, cv2, numpy as np
A = os.environ.get('OUT', 'artefacts/head-turntable-engines')
G = f'{A}/gros-plans'

def lab(img, text, h=34):
    bar = np.full((h, img.shape[1], 3), 255, np.uint8)
    cv2.putText(bar, text, (6, h - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (30, 30, 30), 1, cv2.LINE_AA)
    return np.vstack([bar, img[:, :, :3]])

def fit_h(img, h):
    return cv2.resize(img, (max(1, int(img.shape[1] * h / img.shape[0])), h), interpolation=cv2.INTER_AREA)

def sheet(prefix, yaws, h, out):
    tiles = [lab(fit_h(cv2.imread(f'{G}/{prefix}_yaw_{y:03d}.png'), h), f'{y} deg') for y in yaws]
    cv2.imwrite(f'{A}/{out}', np.hstack(tiles))

sheet('ear', [0, 45, 90, 135, 160], 420, '03-oreille-moteur-5-vues.png')
sheet('jaw', [0, 45, 90, 135, 160], 420, '04-machoire-cou-5-vues.png')

def old(yaw):
    return subprocess.run(['git', 'show', f'HEAD:artefacts/head-turntable/turntable/yaw_{yaw:03d}.png'], capture_output=True).stdout

for yaw in (45, 90, 135):
    a = cv2.imdecode(np.frombuffer(old(yaw), np.uint8), 1)
    b = cv2.imread(f'{A}/apres/turntable/yaw_{yaw:03d}.png')
    h = 560
    cv2.imwrite(f'{A}/05-avant-apres-{yaw:03d}.png', np.hstack([lab(fit_h(a, h), f'AVANT (module a part) {yaw} deg'), lab(fit_h(b, h), f'APRES (moteurs existants) {yaw} deg')]))
print('ok')
