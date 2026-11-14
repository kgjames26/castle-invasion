# 🏰 Castle Invasion v3 — Phases 2 et 3 (combat + économie)

Défense de forteresse médiévale en temps réel contre des hordes de zombies. **Nord en haut**, zombies du nord vers le sud,
muraille horizontale de 200 m en **5 secteurs**, royaume au sud. Pensé d'abord pour le **smartphone en portrait**.

Three.js r170 + JS vanilla (modules ES), **aucune étape de build**. Conception complète : voir le doc `conception-v3-phase1` du Project.

## Lancer
```bash
npm run dev      # http://localhost:5173
npm test         # simulation sans rendu (8 vagues, sauvegarde/restauration)
node tests/headless.mjs 26        # joueur automatique jusqu'à la vague 26
node tests/headless.mjs 12 dumb   # joueur passif
```

## Ce que contient ce prototype
- Carte 200 × 320 m (spawn, approche avec forêts/collines/rochers/chemins, glacis, muraille, royaume, château), brouillard de guerre au nord.
- Muraille : 40 tronçons de 5 m, 5 secteurs indépendants (PV, niveau de résistance, brèches, porte au centre), réparation, renforcement.
- Zombies : 5 types, champ de flux (Dijkstra) par secteur recalculé à chaque brèche, séparation par hachage spatial, rendu en `InstancedMesh`.
- Armée : archers (chemin de ronde, 12 max/secteur) et soldats (pied du mur, 10 max/secteur) + réserve ; tir et mêlée automatiques.
- Vagues : Préparation → Alerte (secteurs ciblés annoncés) → Assaut → Accalmie ; courbe `30 × 1,18^(v−1)`.
- **Onglet Village (Phase 3)** : 5 ressources (bois, pierre, fer, nourriture, or). Le joueur ne fixe que le **nombre de villageois par tâche** ;
  chacun sait quoi faire : aller au site, récolter, **tout rapporter au château**, recommencer. Rendement = effectifs × niveau du bâtiment × outils
  × disponibilité du gisement ; stocks limités (Entrepôt, Grenier) ; nourriture consommée par la population (famine = rendement réduit de moitié).
- Transport et productivité : Outils, **Chariots** (charge), **Chemins pavés** (vitesse), Charrue, Maçonnerie ; bâtiments améliorables (Scierie, Carrière, Mine, Ferme, Moulin, Grenier, Entrepôt, Maisons).
- **Équipe de réparation** : des villageois affectés répondent seuls aux dégâts (brèches d'abord, priorité réglable par secteur), consomment la pierre et attendent que les zombies s'écartent.
- Sauvegarde versionnée (localStorage, v2 ; migration v1→v2 incluse), auto toutes les 30 s et en fin de vague.
- Portrait : barre des 5 secteurs + panneau contextuel. Paysage : terrain pleine largeur + panneau latéral.

## Pas encore (phases suivantes)
Entraînement/files/types d'unités (4), équilibrage et nouveaux ennemis (5), tours automatiques,
cohortes de zombies agrégées (> 4 000), personnages archivés, effets et polissage (6). Onglet Armée : absent tant qu'il serait factice. Les villageois ne peuvent pas encore être attaqués.

## Structure
```
src/sim/       simulation pure (aucune dépendance Three.js/DOM) : monde, mur, zombies, armée, vagues, flux, sauvegarde
src/content/   données de l'époque (medieval.js) — une autre époque = un autre fichier
src/render/    Three.js (lecture seule de l'état)    src/camera/  déplacement/zoom, azimut fixe (jamais de rotation)
src/ui/        interface (état → DOM, commandes → simulation)
assets/archive/ personnages et environnement de l'ancien jeu (copies, voir son README)
```
Ancien jeu : tag `legacy-v2-backup`, branche `legacy/v2`.

## Crédits
Three.js (MIT, `lib/THREE_LICENSE`). Packs assetfactory archivés dans `assets/archive/environment/` (Sketchfab Standard).

## Phase 4 — Armée, escouades, formations, sorties
- **Population partagée** : villageois + tous les militaires (file d'entraînement comprise) sont plafonnés par les **maisons** (base 20, +8 par maison, départ 4, max 60). Construction dans Village → Bâtiments.
- **Onglet 🛡 Armée** : Escouades (formations, posture, garnison par secteur, sortie, compléter, dissoudre) · Entraîner (files Caserne / Écurie / Champ de tir, niveaux = plus vite et plus long) · Forge (armes, armures, archerie).
- **Escouades** : une seule entité à points de vie communs, membres dessinés selon la formation (ligne, phalange, coin, carré, colonne) — chaque formation a des effets chiffrés (`FORMATIONS` dans `content/medieval.js`).
- **Sorties** : « Sortir sur le terrain » puis toucher la zone orange ; l'escouade franchit la muraille **par la porte**, combat les zombies (posture Charge = poursuite + élan), et peut rentrer en garnison. Champ de bataille agrandi : z 90 → 142 (dégagé de forêts/rochers).
- **Garnison** : les escouades défendent l'intérieur et interceptent les zombies entrés par une brèche (rayon `SQUAD.intercept`).
- **Sauvegarde v3** avec migration depuis v2 (soldats → escouades de 10 max).
- Tests : `npm test` (bot sur plusieurs vagues + sauvegarde) et `node tests/sortie.mjs` (sortie + comparaison des formations).
- Reporté : ingénieurs / armes de siège, villageois attaquables, équilibrage fin (Phase 5).

## Phase 5 — Armes de siège
- **Atelier de siège** (Armée → 🛠 Siège) : niveau = 2 armes déployables par niveau ; niv. 1 baliste, niv. 2 catapulte, niv. 3 trébuchet (repris de l'ancien jeu, `SIEGE` dans `content/medieval.js`).
- Armes fixes derrière la muraille, 3 emplacements par secteur, **portée au-delà de leur secteur** (jusqu'à 82 m pour le trébuchet). Équipage = population partagée. Munitions prélevées dans les stocks (fer / pierre) ; une arme sans munitions devient rouge.
- Dégâts de zone pour catapulte et trébuchet (cible choisie là où les zombies sont les plus denses) ; la baliste vise le zombie le plus coriace. Les dégâts suivent l'amélioration « Armes affûtées ».
- Démontage = ½ des ressources rendues. Sauvegarde : champ `siege` (sans changement de version ; les anciennes sauvegardes v3 restent valides).
- Test : `node tests/siege.mjs`. Reporté : bélier mobile, armes attaquables par les zombies.

## Personnages (repris de l'ancien jeu)
`src/render/Characters.js` charge `assets/characters/` (copies de l'archive v2) : **zombies animés** (cycle de marche, 6 modèles, animation par texture de sommets, un seul appel de rendu par modèle), **archers** « Bard the Bowman » (corps + arc, modèle statique) et **villageois** humanoïdes reconstruits à partir du code du cultivateur de l'ancien jeu (teinte selon la tâche, cap selon le déplacement, balancement). Limites : l'archive ne contient ni course, ni attaque, ni mort animées, ni squelette ; pas de modèle de villageois (le sien est procédural). Sans les fichiers, le rendu retombe sur les boîtes provisoires. Les licences des packs « Polyart Zombies » et « Bard the Bowman » ne sont pas fournies : à vérifier.

## Bâtiments militaires
`src/render/Military.js` : quatre modèles simples, lisibles en une vue. **Caserne** (halle rouge, écu bleu aux épées croisées, mannequin, lances, bannières) · **Champ de tir** (pelouse, quatre cibles à anneaux, abri et grand arc) · **Écurie** (grange, fer à cheval, enclos avec cheval, foin) · **Atelier de siège** (charpente ouverte, catapulte, rondins, boulets, roue dentée). Les pastilles dorées au-dessus de l'entrée indiquent le niveau. La forge reste un volume provisoire.

## Ancien jeu (v2)
Sauvegardé dans `legacy/` (ressource de développement : animations, muraille, zombies, archers, villageois…) et intégralement dans la branche `claude/legacy-v2`. Voir `legacy/README.md`.

## Décor du monde (kit)
Le décor vient du pack « Low poly winter medieval castle and town pack » (assetfactory, licence Sketchfab Standard — voir `assets/world/LICENSE-NOTICE.md`), converti en kit compact par `tools/extract_kit.py` et chargé par `src/render/Kit.js` ; `Renderer.useKit()` remplace les boîtes provisoires : tronçons de muraille (4 variantes, porte à escalier), tours, château, **maisons de population** (une par maison construite, 5 modèles), moulin / entrepôt / grenier, église, puits, étals, petits objets, et **chariots** (un de plus par niveau de l'amélioration « Chariots »). Les bâtiments militaires restent des volumes simples provisoires. Sans le kit, le jeu retombe sur les boîtes.

## Phase 6 — Construction libre
- Départ : seulement le château + stock de base. Tous les bâtiments (scierie, carrière, mine, ferme, forge, casernes, moulin, entrepôt, grenier…) se construisent, ainsi que maisons et tours de défense (multiples).
- Placement libre sur la carte (tap ou glisser le fantôme, rotation), déplacement possible (gratuit, bloqué jusqu'au passage d'un ouvrier).
- Chantier standard : échafaudage → bâtiment terminé. Nombre d'ouvriers réglé sur le chantier (− / +).
- Tours : construction + amélioration (niveaux 1–5). Les 6 tours de muraille de départ suffisent aux premières vagues.
- Moteur : `src/sim/build.js`, rendu : `src/render/Structures.js` + `Buildings.js`. Sauvegarde v4 (migration depuis v3). Test : `node tests/build.mjs`.

## Phase 7 — Interface « parchemin » + sol
- Carte plein écran, barre de ressources/vague en haut, dock (Bâtir / Armée / Villageois / Savoir), fiches contextuelles ancrées, barre de placement, interactions tactiles directement sur la carte.
- Nouveau sol : texture unique 6 px/m (zones, chemins, mares, grain).
- Équilibrage des vagues 7+ non retravaillé (le bot de test perd à la vague 7).
