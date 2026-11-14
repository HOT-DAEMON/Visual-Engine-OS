# Preuves visuelles : `artefacts/hair-3d/`

Générateur : `npx tsx scripts/hair-3d-proof.ts <dossier> [graine]`. Le même script produit « avant » (commit de départ `13da21e`, dans un worktree) et « après ».
| Image | Contenu |
|---|---|
| `avant/hairs-360.png`, `apres/hairs-360.png` | 10 coiffures (buzz, short, spiky, curly, afro, bob, long, ponytail, bun, braids) × 6 angles (0°, 45°, 90°, 135°, 180°, 270°), tangage 8°, graine 9000 |
| `avant/details.png`, `apres/details.png` | gros plans 520 px : frange (short), épis (spiky), rasé et tempe (buzz), tresses, queue, long de face |
| `avant/variety.png`, `apres/variety.png` | planche de variété graines 1 – 8 (face, 55°, dos) : avant = `variedHead` (calotte sans volume), après = `variedHairedHead` |
Lecture : rangées = coiffures dans l'ordre ci-dessus (`hairs-360`, `details`) ; la graine 4 de la planche est chauve (pas de volume, attendu).
`verification.txt` : sortie de `scripts/hair-volume/verify.ts` pour les 10 coiffures.
