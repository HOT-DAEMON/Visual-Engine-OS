#!/usr/bin/env python3
"""Assemble les planches de la PASSE 3 de la voûte depuis les vignettes et enregistrements de `artefacts-vault-3.ts` (docs/SKULL-VAULT-3.md).
Usage : compose-vault-3.py <dossier-vignettes> <dossier-artefacts>"""
import json, sys, os
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from compose_lib import *   # VIEWS, VLAB, BG, polices, tile, diff, sheet, grid, fit, load

SRC, DST = sys.argv[1], sys.argv[2]
S = lambda *a: os.path.join(SRC, 'tiles', *a)
V = lambda n: json.load(open(os.path.join(SRC, 'verification', n), encoding='utf-8'))
D = lambda *a: os.path.join(DST, *a)
os.makedirs(DST, exist_ok=True)
MM = 220.0   # 1 U ≈ 22 cm de tête (dessin stylisé : 1 U = hauteur de tête ≈ 22 cm) : conversion indicative des amplitudes en mm

# 1. Têtes complètes
tw, th_ = 250, 270
heads = V('tetes.json')
for i, h in enumerate(heads, 1):
    rows = [('avant', 'avant : nominal, chauve'), ('apres', 'après : chauve'), ('coiffee', 'après : coiffée')]
    ov = ', '.join('%s = %g' % kv for kv in h['ov'].items())
    grid('Tête complète : %s' % h['label'], 'même graine (3), même caméra, même éclairage. Réglages : ' + ov, 3, 6,
         lambda a, b, h=h, rows=rows: load(S('tetes', h['id'], '%s_%s.png' % (rows[a][0], VIEWS[b])), tw, th_),
         [r[1] for r in rows], [VLAB[v] for v in VIEWS], tw, th_, D('tete-complete', '%02d-%s.png' % (i, h['id'])))

# 2. Planches par mesure : min / nominal / max / différence, vues déclarées de la preuve
proofs = {p['id']: p for p in V('proofs-passe3.json')}
for pid, p in proofs.items():
    views = p['expectedViews']; n = len(views)
    lab = ['min = %g' % p['lo'], 'nominal = %g' % (p['nom'] if p['nom'] is not None else 0), 'max = %g' % p['hi'], 'différence min ↔ max (rouge)']
    best = p['best']
    grid('Preuve visuelle : %s' % pid, 'perceptible = %s ; meilleure vue : %s (xor %.2f %%, ombrage %.2f %%)' % (p['perceptible'], best['view'], best['xor'] * 100, best['shadeFrac'] * 100), 4, n,
         lambda a, b, pid=pid, views=views: load(S('param', pid, '%s_%s.png' % (['lo', 'nom', 'hi'][a], views[b])), 250, 270) if a < 3 else fit(diff(S('param', pid, 'lo_%s.png' % views[b]), S('param', pid, 'hi_%s.png' % views[b])), 250, 270),
         lab, [VLAB[v] for v in views], 250, 270, D('parametres', '%s.png' % pid), 'même graine, même caméra, même lumière ; seuils : xor ≥ 0,4 % ou ombrage ≥ 0,5 % (inchangés)')

# 3. Gros plans
zoom = V('zoom.json'); zw, zh = 300, 242
grid('Gros plans : chaque structure, là où le REGISTRE la déclare', 'fenêtre 0,62 × 0,5 U centrée sur l\'ancre (par côté pour les asymétries) ; rouge = pixels qui changent entre min et max', len(zoom), 4,
     lambda a, b: load(S('zoom', '%s_%s.png' % (zoom[a]['id'], ['lo', 'nom', 'hi'][b])), zw, zh) if b < 3 else fit(diff(S('zoom', '%s_lo.png' % zoom[a]['id']), S('zoom', '%s_hi.png' % zoom[a]['id'])), zw, zh),
     ['%s\n%s, côté %s' % (z['parametre'], z['vue'], {1: '+x', -1: '-x', 0: 'médian'}[z['cote']]) for z in zoom], ['min = -1', 'nominal = 0', 'max = +1', 'différence min ↔ max'], zw, zh, D('gros-plans.png'),
     'bases : sillon sous chignon 0,6 ; bosses frontales 0,5 ; mastoïde 1 ; bombement pariétal 1 (une asymétrie ne se lit que sur une structure qui existe)')

# 4. Accord contour 2D / silhouette 3D
ag = V('accord-2d-3d.json'); nom = V('accord-nominal-12-tetes.json')
fig, axs = plt.subplots(2, 3, figsize=(15, 8.2)); fig.suptitle('Accord du contour POSTÉRIEUR du profil 2D (moteur src/skull) et de la silhouette 3D (à un décalage constant près, repère t = 0,3)\nnominal : 12 têtes, pire écart %.4f U (borne 0,018) ; les extrêmes qui divergent sont rapportés, pas cachés' % nom['pire'], fontsize=11)
for ax, c in zip(axs.flat, ag):
    t = np.array(c['t']); ax.plot(t, np.array(c['contour2D']) * MM / 10, 'o-', c='#2060c0', label='contour 2D (src/skull)'); ax.plot(t, np.array(c['silhouette3D']) * MM / 10, 's--', c='#c03020', label='silhouette 3D (profil 90°)')
    ax.set_title('%s\nécart max %.4f U ≈ %.1f mm' % (c['id'], c['ecartMax'], c['ecartMax'] * MM), fontsize=10); ax.set_xlabel('hauteur t depuis le sommet (U)'); ax.set_ylabel('recul de l\'occiput (cm), relatif à t = 0,3'); ax.grid(alpha=.3); ax.invert_yaxis()
axs[0, 0].legend(fontsize=8); fig.tight_layout(rect=(0, 0, 1, 0.92)); fig.savefig(D('accord-2d-3d.png'), dpi=110); plt.close(fig)

# 5. Queue de la mastoïde conique
q = V('queue-mastoide.json'); ys, azs = np.array(q['y']), np.array(q['az']); A, B = np.array(q['avant']) * MM, np.array(q['apres']) * MM
fig, axs = plt.subplots(1, 3, figsize=(16, 5.2)); vmax = float(A.max())
for ax, M, ttl in zip(axs, (A, B, A - B), ('AVANT : cône exp(−½ r^1,1), queue longue', 'APRÈS : queue fondue entre 2 σ et 4 σ', 'ce qui est retiré (mm)')):
    im = ax.imshow(M, origin='upper', aspect='auto', extent=[azs[0], azs[-1], ys[-1], ys[0]], cmap='magma', vmin=0, vmax=vmax); ax.set_title(ttl); ax.set_xlabel('azimut (°) ; 0 = face, 180 = nuque'); ax.set_ylabel('hauteur (U)')
    ax.axvline(40, c='cyan', ls=':', lw=1); ax.text(41, ys[0] + .02, 'limite du contrôle\nà 40° (front, tempe)', color='cyan', fontsize=8, va='top'); plt.colorbar(im, ax=ax, label='relief (mm de tête)')
fig.suptitle('Mastoïde conique (taille +1, pente −1), cuir chevelu le plus mince et os apparent (transmission %.1f) : relief de la seule mastoïde' % q['transmission']); fig.tight_layout(rect=(0, 0, 1, 0.93)); fig.savefig(D('queue-mastoide.png'), dpi=110); plt.close(fig)

# 6. Audit de consommation (tableau)
au = V('audit-consommation.json'); au.sort(key=lambda r: r['id'])
rowh, W = 17, 1480
im, d = sheet(W, 88 + rowh * (len(au) + 1), 'Audit de consommation : chaque mesure exposée est lue, et là où le registre le déclare', 'tête min vs tête max (mêmes graine / caméra / lumière) ; relief : maillage hauteur × azimut ; coupes : largeur / profondeur / exposants ; fuite = part de l\'écart de relief hors de la bande déclarée (+0,07 U, +14°)')
cols = [('mesure', 10), ('lue', 200), ('relief max (U)', 250), ('zone MESURÉE du relief (y, azimut)', 370), ('coupes max / exposants', 700), ('bande DÉCLARÉE (y, azimut)', 880), ('fuite', 1250)]
for t, x in cols: d.text((x, 62), t, font=FB if False else F, fill=(20, 20, 20))
fmt = lambda b: '—' if not b else 'y %.2f–%.2f  az %d–%d°' % (b['y'][0], b['y'][1], b['az'][0], b['az'][1])
for i, r in enumerate(au):
    y = 88 + i * rowh; col = (20, 120, 40) if r['consumed'] and r['leak'] < .06 else (190, 30, 30)
    if i % 2: d.rectangle([0, y - 1, W, y + rowh - 2], fill=(242, 239, 232))
    dec = r['declared']; decs = '—  (aucune structure : lu par le moteur de joue / maxillaire)' if not dec else 'y %.2f–%.2f  az %d–%d°' % (dec['y'][0], dec['y'][1], dec['az'][0], dec['az'][1])
    rows_ = '%.3f U / exp %.2f' % (r['rows']['max'], r['rows']['exp']) if r['rows']['y'] else '—'
    for txt, x in ((r['id'], 10), ('oui' if r['consumed'] else 'NON', 200), ('%.4f' % r['relief']['max'] if r['relief']['box'] else '—', 250), (fmt(r['relief']['box']), 370), (rows_, 700), (decs, 880), ('%.1f %%' % (r['leak'] * 100), 1250)):
        d.text((x, y), txt, font=FS, fill=col if x in (200, 1250) else (30, 30, 30))
im.save(D('audit-consommation.png'), optimize=True)

# 7. Plafonds de relief selon les tissus
pl = V('plafonds-tissus.json'); sc, bn = pl['scalp'], pl['boneShow']
fig, axs = plt.subplots(1, 2, figsize=(12.5, 4.6))
for ax, (k, ttl) in zip(axs, (('tous_a_plus_un', 'TOUS les reliefs à +1 (même fraction s)'), ('tous_a_moins_un', 'TOUS les reliefs à −1 (même fraction s)'))):
    M = np.array([[next(c['s'] for c in pl['combinaison'][k] if c['scalp'] == s and c['boneShow'] == b) for b in bn] for s in sc])
    im = ax.imshow(M, vmin=0.7, vmax=1, cmap='RdYlGn'); ax.set_xticks(range(3)); ax.set_xticklabels(['os caché (−1)', 'nominal (0)', 'os apparent (+1)']); ax.set_yticks(range(3)); ax.set_yticklabels(['cuir chevelu mince (0,05)', 'moyen (0,5)', 'épais (0,95)']); ax.set_title(ttl, fontsize=10)
    for i in range(3):
        for j in range(3): ax.text(j, i, '%.0f %%' % (100 * M[i, j]), ha='center', va='center', fontsize=13, fontweight='bold')
fig.suptitle('Plafond de la COMBINAISON des reliefs selon les tissus (part de l\'extrême que la couche de vérification tolère : amplitude ≤ 0,06 U, saut ≤ 0,014 U)\nchaque relief SEUL tient partout (plafond 100 %) : seule la superposition sous une peau mince plafonne', fontsize=10)
fig.tight_layout(rect=(0, 0, 1, 0.88)); fig.savefig(D('plafonds-tissus.png'), dpi=110); plt.close(fig)
print('planches écrites dans', DST)
