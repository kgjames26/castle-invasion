# Archive d'assets — Castle Invasion v2 (copie, originaux intacts)

Sauvegarde complète de l'ancien jeu : tag `legacy-v2-backup`, branche `legacy/v2`.

## characters/
- `archer.bin` — « Bard the Bowman » : 2 parties (body 8 768 sommets, bow 2 807), maillage **statique** pré-calculé
  (couleurs de sommets, positions quantifiées 16 bits). Pas de squelette, pas d'animation embarquée.

## animations/
- `zombies-walk-vat.bin` — pack « Polyart Zombies » : 6 variantes, cycle de **marche uniquement**, 16 poses
  pré-calculées (Vertex Animation Texture). Pas de squelette, pas de course/attaque/mort.

## environment/
- `medieval.glb` — 35 meshes (château, tours, murailles, maisons, tentes, décors), sans squelette ni animation.
- Licences assetfactory (Sketchfab Standard).

## code-reference/
- `AnimModels.js` — décodeur des deux .bin + shaders VAT (nécessaire pour relire les fichiers).
- `Models.js` — unités low-poly procédurales de l'ancien jeu.

## ⚠ Manquant
Les GLB/GLTF **sources** (squelettes, rigging, animations course/attaque/mort, textures) ne sont pas dans ce dépôt :
seuls les maillages cuits ci-dessus y figurent. Aucune licence n'est fournie pour les packs « Polyart Zombies » et « Bard the Bowman ».
