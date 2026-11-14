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

## Phase 8 — Troupes animées, hordes, prospection
- `src/render/Troops.js` : fantassin, lourd, cavalier (cheval + épée), baliste, catapulte, trébuchet — modèles en boîtes, animés par pièces (marche/galop, coups d'épée en combat, bras de lancer synchronisé sur le rechargement).
- Zombies : arrivée par **groupes** compacts (même secteur, même type dominant) ; **Colosse** (×4,4 la taille d'un classique, dès la vague 4, « parfois »).
- Bois : la forêt des bûcherons **repousse** (3,2/s) et les arbres rapetissent/regrandissent visiblement.
- **Prospection** (onglet Villageois) : 40 or + 30 vivres, un villageois libre explore 45 s puis un nouveau gisement de pierre/fer/or apparaît ailleurs (max 3 par ressource) ; les récolteurs se répartissent entre gisements.
- Zoom max augmenté (min 0,1) ; archers agrandis pour s'accorder aux fantassins.

## Phase 9 — Villageois animés, bâtiments lisibles, gisements
- Mobilier, puits, mares et terre de la ferme supprimés (sol + décor).
- Placement : la **mine** se pose uniquement sur un gisement de fer/or (aimantée, y compris gisements découverts) ; aucun autre bâtiment ne peut recouvrir un gisement ; la **ferme** se pose librement et les fermiers y travaillent.
- Villageois : un modèle par métier (hache, pic, houe, marteau), animés : marche, coups d'outil (bois, pierre, fer, or, ferme, chantier, réparation), charge portée devant la poitrine.
- Bâtiments redessinés (scierie, carrière, mine, ferme, forge + accessoires sur moulin/entrepôt/grenier) et **enseigne** à l'icône du métier au-dessus de chaque bâtiment.

## Phase 10 — Villageois : nouveau modèle GLB animé
- `tools/bake_villager.py` convertit `medieval_civilian_3.glb` (squelette Mixamo) en `assets/characters/villager.bin` : peau linéaire, textures cuites en couleurs de sommets, 40 images d'animation (marche, portage, travail, repos) lues par texture de sommets (VAT), 8 variantes de couleur de tunique (un par métier).
- Outil (hache, pioche, houe, marteau) et chapeau (casquette, casque de chantier, paille…) sont des maillages instanciés collés à la main droite / à la tête image par image.
- `Renderer.useVillagerGLB` / `updateVillagersVAT` : clip choisi selon l'état (déplacement, charge, travail, repos) ; l'ancien villageois en boîtes reste en repli si le fichier est absent.
- Usage : `python3 tools/bake_villager.py <glb> assets/characters/villager.bin`.

## Phase 11 — Cheval GLB animé (support des cavaliers)
- `tools/bake_horse.py` : le GLB `low_poly_horse` n'a ni squelette ni animation ; le script reconstruit un squelette à la main (pattes à deux segments, cou/tête, queue souple, tangage du corps) et cuit 3 allures en VAT : pas (16 images), galop (12), repos (12), plus la matrice de selle de chaque image. Usage : `python3 tools/bake_horse.py <glb> assets/characters/horse.bin`.
- 8 robes (alezan/bai, noir, blanc, alezan clair, gris, palomino, isabelle, pie) : couleurs de sommets (corps · crinière/queue · balzanes), choisies par escouade ; `Renderer.useHorseGLB` crée une maille instanciée par robe.
- Le cavalier (`horseParts` dans Troops.js) n'est plus qu'un rig de boîtes posé sur la selle et suit le tangage du cheval. Allure : galop en déplacement rapide, pas sinon, repos à l'arrêt/au combat.
- Pour ajouter une robe : une entrée dans `SKINS` de `bake_horse.py`, puis relancer le script.

## Phase 12 — Échelle réaliste (fin de l'effet « maquette »)
- Personnages réduits d'environ 35 % par rapport aux bâtiments : zombies `ZSCALE` 1.45, archers 1.55, `USCALE` 1.75, soldats 1.6 / lourds 1.8 / cavaliers 1.35, machines de siège ×0.72, villageois GLB `SC` 0.0105 (≈ 2 m).
- Caméra : inclinaison 58° → 42° (vue plus rasante), champ de vision 50° → 58°, zoom minimum 0.1 → 0.05, vue de départ plus proche du château.
- Dalles de la cour et pavés du château deux fois plus petits (repères d'échelle).

## Phase 13 — v1.1 : version affichée, muraille GLB, porte à battants, ralliement
- **Version** : `src/version.js` (affichée sur l'écran de lancement, en bas à gauche du jeu et dans ☰ Paramètres). Elle monte toute seule à chaque commit (`.githooks/pre-commit` → `tools/bump-version.mjs`) ; activer le hook avec `git config core.hooksPath .githooks`.
- **Muraille** : panneaux de `assets/wall/dungeon_wall.glb` (façade extérieure ~6,4 m + parement intérieur) autour d'un cœur dont le dessus est le chemin de ronde (`WallView.js`). **Escaliers** (2 par secteur) : les archers assignés montent à pied jusqu'à leur créneau et ne tirent qu'une fois arrivés. **Porte centrale** : deux battants (même panneau) pivotent vers l'intérieur quand une escouade doit passer ; l'escouade attend que la porte soit ouverte.
- **Archers** nettement plus petits (`ASC` = 0,95).
- **Recrues** : chaque unité entraînée sort de son bâtiment et marche jusqu'à la placette (par défaut) ou jusqu'au point choisi via Armée → 📍 Point de ralliement.
- **Disposition (nord → sud)** : armée en formation sur le champ de bataille · muraille (z 142-150) · armée de garnison (z 160-185) · placette (z 188-208) · village (constructible à partir de z 212). Casernes, écurie, champ de tir, forge et atelier déplacés dans le village.

## Phase 14 — Trois portes, chantiers en file, ressources, château gris
- **Trois portes** (`GATE_SEGS` dans constants.js) : gauche (x 15-25), centre (x 95-105), droite (x 175-185). Chaque escouade passe par la porte la plus proche de sa position, cavalerie comprise. Chaque porte s'ouvre à son propre rythme (`army.gate[]`). Les portes latérales évitent les escaliers des archers.
- **File de construction** : plusieurs bâtiments identiques (maisons, tours) se construisent un par un, avec une seule équipe ; les suivants attendent sans prendre d'ouvriers (`build.js`, `update`).
- **Emprunt d'ouvriers** : si un chantier demande des ouvriers et qu'aucun n'est libre, un villageois est pris à la tâche la moins urgente (`eco.borrow`, urgence = stock rare ou muraille blessée) puis retourne à sa tâche d'origine à la fin du chantier (`eco.returnHome`, `home` sauvegardé).
- **Ressources** : forêt plus dense, arbres plus grands (environ 55 % de hauteur en plus, 46 arbres repoussants au bûcheron) ; gisements de départ (`START_DEPOSITS`) : 2 fer, 1 or, 1 pierre sur les bords de la zone constructible.
- **Château** : échelle 0,8 → 0,96 (+20 %) ; matériau `Stone.js` (pierre grise procédurale projetée sur les faces verticales et horizontales), à la place du blanc neige du kit.
- Tests : `tests/chantiers.mjs` (file, emprunt et retour, portes). `tests/build.mjs` tient compte des gisements de départ.

## Phase 15 — Rangs militaires
- Le niveau de la caserne, de l'écurie et du champ de tir (1 à 5) est le rang de ses unités : Recrue, Régulier, Vétéran, Élite, Légende (`RANKS` dans medieval.js : coût, force, résistance, vitesse ; le moral est noté mais pas encore simulé).
- Passage au rang suivant payant et de plus en plus cher (`RANK_UP`). Le coût d'une unité est fixé à l'entraînement (`army.unitCost`), la force et la vitesse suivent le rang courant du bâtiment, la résistance divise les dégâts reçus.
- Test : `tests/rangs.mjs`.

## Phase 16 — Atmosphère et retours d'interface
- `src/render/config.js` : constantes d'atmosphère (soleil, ciel, brume), caméra (inclinaison 40°, champ 60°) et qualité (`low`/`medium`/`high`, choisie par `?q=`, ☰ Paramètres ou automatiquement : `low` sur écran tactile). `low` coupe ombres et lueurs.
- Ombres douces (PCF) sur muraille, château et bâtiments ; brume du nord qui respire et avance pendant l'assaut ; lueurs additives (torches des portes, impacts, explosions) sans post-traitement ; fumée de cheminées.
- UI : indicateur de portée (tour ou secteur d'archers), toasts typés et regroupés (brèche, vague, sortie des escouades), flash d'écran, retour tactile du dock (+ vibration), astuces de premier lancement désactivables (`UI_FLAGS.tutorial` ou `?tuto=0`).
- Château colorié (`Stone.js`, `stoneMaterial(..., true)`) : toits en tuiles rouges (donjon) ou ardoise bleue (tours), murs en grès chaud, mousse au pied. Sol : mousse, galets, fissures, grain deux tons ; touffes d'herbe instanciées balancées par le vent (`buildGrass`, quantité selon la qualité).

## Phase 17 — Passe « améliore tout »
- Bâtiments du kit recolorés (`kitMaterial` dans Stone.js) : toits variés (tuile, chaume, ardoise, vert-de-gris), crépis chauds ; tours de muraille en ardoise ; grain léger sur les bâtiments en volumes simples (`patchGrain`) ; cœur et escaliers de la muraille en pierre texturée.
- Environnement : sapins à deux étages aux teintes variées (neige seulement au nord), forêt et sol prolongés autour de la carte (plus de vide noir), herbe givrée claire au nord.
- Personnages : ombres de contact sous zombies, villageois, recrues et escouades ; teintes de zombies plus marquées par type, blessés rougeâtres.
- Jouabilité : colosse à partir de la vague 6 (au lieu de 4) ; alerte quand la muraille est abîmée sans réparateur.

## Phase 18 — Guerre spectaculaire, magicien, chevaliers, rangs visibles
- **Magicien** (`src/sim/mage.js`) : la Maison du sorcier (🔮, 5 niveaux) invoque UN magicien autonome. Il choisit seul selon l'urgence : soin d'escouade, rempart magique (referme une brèche), boule de feu, éclair en chaîne, pluie de météores, nova de givre (`MAGE` dans medieval.js). Il garde ses distances, revient 30 s après sa chute. Amélioration de forge-magie : Arcanes.
- **Chevalier** (`UNITS.knight`, caserne niv. 3) : frappe plusieurs zombies à la fois (`cleave`), lames d'acier à la forge. Modèle tiré du GLB fourni, décimé et découpé en pièces animées (`tools/bake_knight.py` → `assets/characters/knight.bin`).
- **Objets** du pack FBX convertis (`tools/fbx_items.py` → `assets/items/items.bin`) : épées (recrue → légende dorée), cristaux, grimoire, potions.
- **Explosions et feu** : `sim.explode` (dégâts de zone + feu au sol `sim.fires`), boulets de catapulte et trébuchet enflammés ; `sim.blasts` publie chaque effet pour le rendu. `Effects.js` : flammes, fumée, ondes de choc, brûlures au sol, éclairs, soins, givre, secousse de caméra.
- **Hordes** : chaque zombie garde sa place dans son groupe (cohésion + allure commune) → front large, plus de file indienne.
- **Rangs visibles** (Recrue → Légende) : tenue des fantassins, lourds, cavaliers, chevaliers et archers ; machines de siège selon l'atelier (ferrures, dorures, brasero) ; magicien de l'apprenti à l'archimage ; coups de mêlée plus impressionnants (étincelles, arcs de taille, onde de choc) — sans magie.
- **Village** : chaque niveau de scierie, carrière, mine, ferme… ajoute des installations (`Village.js`) ; « Chemins pavés » pave vraiment les chemins ; « Chariots » = brouettes puis charrettes ; « Outils » change la teinte des fers.
- **Muraille** : châtelets (tours, salle de herse, bannières) et herses de fer qui montent ; créneaux et contreforts.
- **Jouabilité** : emprunt de villageois pour toute tâche (retour automatique), réparation automatique, difficulté (facile/normal/difficile), ordres directs aux escouades (toucher la carte), onglets ⭐ Rangs et 🔮 Magie, « Où améliorer quoi ? » dans Savoir, échelles harmonisées (humains ≈ 2,3 m), herbe masquée sous les bâtiments, qualité adaptative (`?fps=1` affiche les images/s).
- Sauvegarde v5 (structures mal placées replacées au chargement). Test : `tests/magie.mjs`.

## Phase 19 — Golems, infirmerie, université, forge par type, grosse population
- Bug corrigé : le château et les tours de la muraille n'apparaissaient plus (un commentaire avalait une déclaration dans `Renderer.useKit`).
- Herbe : mini-touffes immobiles (3 brins, sans animation).
- **Format de partie** (`FORMATS` dans config.js : Téléphone / Tablette / Ordinateur) : proposé selon l'appareil à la création d'une partie, modifiable seulement à cet écran, enregistré dans la sauvegarde ; plus de changement de qualité en cours de partie.
- **Population** : château 40 places, maisons +15 (70 maisons max) ; jusqu'à 720 villageois affichés.
- **Golem** (zombie de type 6, dès la vague 5, `GOLEM`) : ses coups font trembler les tronçons voisins et font tomber des archers du chemin de ronde (la moitié survit et retourne en réserve) ; modèle de pierre articulé (`golemParts`), chute des archers animée.
- **Infirmerie** (🏥, 3 niveaux, `INFIRMARY`) : soigne les escouades en garnison hors combat, sauve une partie des combattants tombés.
- **Forge** (3 niveaux, `SMITH`) : attaque et défense propres à chaque type (archers, fantassins, lourds, chevaliers, cavaliers, tours et machines, magicien), indépendantes du rang ; plafond 2/4/6. Les anciennes améliorations globales sont converties.
- **Université** (🎓, 3 niveaux) : toutes les améliorations des villageois en dépendent (plafond = niveau + 1) ; nouvelle amélioration Apprentissage (construction plus rapide).
- **Ferme** 6 niveaux (champs, potager et poulailler, verger, silo et grange, pâture avec bêtes) et **moulin** 5 niveaux (fournil, socle de pierre, roue à aubes ; le moulin grandit).
- **Minerais en 3D** (`Ores.js`) : affleurements de pierre, de fer (rouille, cristaux d'hématite) et d'or (filons, pépites), taille selon la réserve.
- Test : `tests/golem.mjs`.
