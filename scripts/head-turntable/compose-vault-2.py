#!/usr/bin/env python3
"""Assemble les planches de la PASSE 2 de la voûte depuis les vignettes de `artefacts-vault-2.ts` (docs/SKULL-VAULT-2.md).
Usage : compose-vault-2.py <dossier-vignettes> <dossier-artefacts>"""
import json, sys, os
from compose_lib import *   # VIEWS, VLAB, BG, polices, tile, diff, sheet, grid, fit, load

SRC, DST = sys.argv[1], sys.argv[2]
S = lambda *a: os.path.join(SRC, 'tiles', *a)
D = lambda *a: os.path.join(DST, *a)
comp = json.load(open(os.path.join(SRC, 'verification', 'composites.json'), encoding='utf-8'))
zoom = json.load(open(os.path.join(SRC, 'verification', 'zoom.json'), encoding='utf-8'))
ids = [k for k in comp if not k.startswith('profil2d_')]
tw, th_ = 250, 270

# 1. Tête complète : AVANT (nominal) / APRÈS (famille de la passe 2), chauve puis coiffée, six vues, même caméra et même éclairage.
for i, cid in enumerate(ids, 1):
    rows = [('avant', 'avant : nominal, chauve'), ('apres', 'après : chauve'), ('apres-cheveux', 'après : coiffée')]
    ov = ', '.join('%s = %g' % kv for kv in comp[cid]['overrides'].items())
    grid('Tête complète : %s' % comp[cid]['label'], 'même graine (3), même caméra, même éclairage. Réglages : ' + ov, 3, 6,
         lambda a, b, cid=cid, rows=rows: load(S('tete', '%s_%s_%s.png' % (cid, rows[a][0], VIEWS[b])), tw, th_),
         [r[1] for r in rows], [VLAB[v] for v in VIEWS], tw, th_, D('tete-complete', '%02d-%s.png' % (i, cid)))

# 2. Gros plans centrés sur l'ancre du registre (fenêtre 0,62 × 0,5 U) : min / nominal / max / différence.
zw, zh = 300, 242
labs = ['min', 'nominal', 'max', 'différence min ↔ max']
grid('Gros plans : chaque structure, là où le REGISTRE la déclare', 'fenêtre 0,62 × 0,5 U centrée sur l\'ancre (position locale → globale → pixel) ; rouge = pixels qui changent entre min et max', len(zoom), 4,
     lambda a, b: load(S('zoom', '%s_%s.png' % (zoom[a]['id'], ['lo', 'nom', 'hi'][b])), zw, zh) if b < 3 else fit(diff(S('zoom', '%s_lo.png' % zoom[a]['id']), S('zoom', '%s_hi.png' % zoom[a]['id'])), zw, zh),
     ['%s\n%s' % (z['parametre'], z['vue']) for z in zoom], labs, zw, zh, D('gros-plans.png'),
     'chaque ligne : un seul paramètre varie (les autres sont nominaux) ; sauf asymMastoid : mastoid = 0,5 ; 0 = tête identique à celle d\'avant')

# 3. Profil 2D : la même mesure, la même fonction de forme ; contours min (bleu) / nominal (noir) / max (rouge).
keys = ['browArch', 'frontalEminence', 'metopicRidge', 'occipitalBun', 'inionSize', 'parietalHeight']
grid('Profil 2D (moteur src/skull) : mêmes mesures, mêmes formes que la 3D', 'os seul (la coiffure masquerait la voûte) ; contours : bleu = min, noir = nominal, rouge = max', len(keys), 4,
     lambda a, b: load(S('profil2d', '%s_%s.png' % (keys[a], ['lo', 'nom', 'hi', 'contours'][b])), 250, 290),
     keys, ['min = -1', 'nominal = 0', 'max = +1', 'contours superposés'], 250, 290, D('profil-2d.png'),
     'parietalHeight avec parietalBulge = 1 ; +1 = éminence HAUTE (sens corrigé) ; déplacements maximaux : verification/composites.json (profil2d_*)')

# 4. Ancre de visibilité pariétale : le point suit l'éminence (vert = vu ou sur le contour, rouge = caché).
pk = ['parietalHeight', 'parietalAzimuth', 'asymParietalHeight']
grid('L\'ancre du registre SUIT l\'éminence pariétale', 'ancres du registre, deux côtés ; vert = vue ; parietalBulge = 1 ; dessus pour l\'azimut, dos sinon', 3, 3,
     lambda a, b: load(S('ancre', '%s_%s.png' % (pk[a], ['lo', 'nom', 'hi'][b])), 300, 300), pk, ['min = -1', 'nominal = 0', 'max = +1'], 300, 300, D('ancre-parietale.png'))

# 5. Cheveux : posés sur le même maillage, ils suivent le relief.
hs = [('nominal', 'nominal'), ('chignon', 'chignon +1, inion 0,6'), ('chignon-moins', 'chignon -1 (méplat)'), ('bosses', 'bosses +1, pariétaux 0,7'), ('arcade', 'arcade +1, glabelle 0,5')]
grid('Cheveux posés sur le même relief', 'tête coiffée, graine 3 ; la coiffure est construite sur la surface de la voûte', len(hs), 3,
     lambda a, b: load(S('cheveux', '%s_%s.png' % (hs[a][0], ['trois_quarts', 'profil', 'dos'][b])), 280, 300), [h[1] for h in hs], ['3/4 45°', 'profil 90°', 'dos 180°'], 280, 300, D('cheveux-suivent-le-relief.png'))
print('planches de la passe 2 écrites dans', DST)
