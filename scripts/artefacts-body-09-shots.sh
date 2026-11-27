#!/usr/bin/env bash
# Usage : scripts/artefacts-body-09-shots.sh <arbre> <dossier de sortie>
# Rend les mêmes cadrages sur l'arbre « avant » (commit d'origine de la branche) et « après » ; assemblage par scripts/artefacts-body-09-compose.py.
set -e
T="$1"; O="$2"; mkdir -p "$O"; cd "$T"
Z="npx tsx scripts/body-refs/zoom-shot.ts"
for a in veryMuscular adultMale thin; do $Z $a 180 -1.2,0.0,2.4,1.9 "$O/dos-$a.png" 800 | tail -1; done
for a in muscular adultFemale; do $Z $a 180 -1.2,0.0,2.4,1.9 "$O/dos-$a.png" 800 | tail -1; done
for a in veryMuscular adultMale; do
  $Z $a 90 -0.6,0.0,1.2,0.9 "$O/epaule-profil-$a.png" 700 | tail -1
  $Z $a 0 -1.7,-0.2,1.3,1.1 "$O/epaule-face-$a.png" 700 | tail -1
  $Z $a 0 0.85,2.7,0.9,1.15 "$O/main-face-$a.png" 520 | tail -1
done
npx tsx scripts/artefacts-body-08-figure.ts "$O/fig" | tail -1
