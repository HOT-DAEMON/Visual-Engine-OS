/* GÉNÉRÉ par scripts/head-turntable/fit-engines.ts — ne pas modifier à la main (les paramètres non ajustés viennent de engine-fixed.ts). */
/** Paramètres des moteurs existants recalés sur la planche (références/face/rotation_head.jpg). Résidus : voir artefacts/head-turntable-engines/fit_report.json. */
export interface EngineFit {
  readonly face: Readonly<Record<string, unknown>>;
  readonly skull: Readonly<Record<string, unknown>>;
  /** Largeur du crâne (px = 0,001 U). [ajusté] */
  readonly W: number;
  /** z (U) du porion = origine du repère de profil des moteurs. [ajusté] */
  readonly zPorion: number;
  /** Inclinaison du ramus (°) : plan mandibulaire = angle gonial − 90° − ramus. [ajusté] */
  readonly ramusDeg: number;
  /** z de l'axe du cou (U) = pivot de rotation. [mesuré] */
  readonly neckZ: number;
  /** Épaisseur de la coupe de cheveux sur le crâne (U). [ajusté] */
  readonly hairTh: number;
  /** Facteur sur la demi-profondeur du cou du moteur (sa borne basse, 0,34 H, dépasse le cou de la planche). [ajusté] */
  readonly neckScale: number;
  /** Courbure du dessous de la mandibule (z −= κ·d², d = distance au bas du menton en U) : le corps de la mandibule est un arc, pas une droite. [ajusté] */
  readonly mandArc: number;
}
export const ENGINE_FIT: EngineFit = {
  "face": {
    "anatomyEngine": "structured",
    "jaw": {
      "mobility": 0,
      "angle": 0.8999997947004481,
      "taper": 0.9297553876052872
    },
    "mouth": {
      "width": 0.26,
      "open": 0.6,
      "curve": 0.5,
      "y": 0.8096483125029799,
      "upperLip": 0.15266277908325554,
      "lowerLip": 0.75
    },
    "nose": {
      "width": 0.14,
      "root": {
        "height": 0
      },
      "length": 0.16929962847491847,
      "tip": {
        "projection": 0.08212842280933585,
        "rotation": 0.8999999999999999
      }
    },
    "ears": {
      "family": "human",
      "attach": {
        "openingDeg": 28,
        "pitchDeg": 0,
        "rotationDeg": 6
      },
      "morph": {
        "width": 0.78
      },
      "anchors": {
        "crusLevel": 0.34
      },
      "style": {
        "look": "anime",
        "detail": 0.55,
        "asymmetry": 0
      }
    },
    "templeY": 0.4685800603908207,
    "jawY": 0.8068622959571599,
    "jawWidth": 0.6606972999888001,
    "chinWidth": 0.33700729204041535,
    "chin": {
      "height": 0.1040233895552943,
      "projection": 0.4756158024682089,
      "form": 0.8409229374154453,
      "symphysisWidth": 0.20359753530887037
    },
    "eyeLine": 0.5696585273280446,
    "eyeGap": 0.22941434348940568,
    "neck": {
      "width": 0.3870176103293639
    }
  },
  "skull": {
    "length": 0.013268336167209904,
    "vaultHeight": 0.15107127099363343,
    "vaultPeak": 0.2151449288118988,
    "foreheadSlope": 0.13844712353011562,
    "frontalBulge": 0.9,
    "occiput": 0.7217710473207734,
    "maxilla": -0.3698696223949943,
    "neckTilt": 0.9,
    "neckDepth": 0.00029706713879695736
  },
  "W": 737.9569171503307,
  "zPorion": 0.03350414020432105,
  "ramusDeg": 0.11549169095304324,
  "neckZ": 0.04,
  "hairTh": 0.05,
  "neckScale": 0.7742307322851883,
  "mandArc": 2.31597548355065
};
