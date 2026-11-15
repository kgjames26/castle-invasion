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

## Phase 20 — Monde étendu, routes, nuit et feux
- **Forêts vierges** (`src/sim/frontier.js`, `FRONTIER`) : le front ne change pas ; au niveau du village, la carte s'étend de 200 m à gauche et à droite. 100 parcelles de 20 m à défricher, de proche en proche ; la tâche « Défricheurs » abat le bois (rapporté au stock) ; une parcelle rasée devient constructible et révèle parfois un gisement (pierre, fer, or). Toucher une forêt ouvre sa fiche.
- **Dépôts** : les porteurs déposent au plus proche (château, entrepôt, scierie, carrière, mine, grenier, moulin, ferme).
- **Routes** (`src/sim/roads.js`, `ROADWORKS`) : réseau automatique (chaque bâtiment terminé est relié) + routes tracées par le joueur (bâtiment Travaux publics, bois et pierre au mètre, posées peu à peu). Le niveau des Travaux publics fixe la qualité de toutes les routes (terre battue, gravier, pavés : +15/30/45 % de vitesse). « Chemins pavés » de l'université est remplacé.
- **Jour et nuit** (`src/sim/night.js`, `DAY`) : cycle progressif de 7 minutes ; la nuit, archers et tours voient moins loin sans feu. Lumière, ciel et soleil suivent l'heure ; indicateur ☀/🌅/🌇/🌙.
- **Braseros et allumeurs** (`BRAZIERS`, `FIRE_KEEP`) : 22 braseros (muraille, champ de bataille, cour, village) ; la tâche « Allumeurs de feux » les allume et les ravitaille en bois à l'approche de la nuit, passe par les portes pour ceux du champ de bataille et rentre si un zombie approche. Les zombies qui passent dessus les éteignent.
- **Flèches enflammées** (forge niveau 2, 3 niveaux) : archers et tours enflamment le sol à l'impact.
- Sauvegarde v6. Test : `tests/monde.mjs`.

## Phase 21 — Muraille en arc
- La muraille forme un léger arc bombé vers le nord (`WALL_BOW` = 7 m au centre, `wallOff(x)` dans constants.js).
- Tout suit la courbe : remparts, merlons, escaliers, portes et herses, tours fixes, archers, braseros, engins de siège, champ de flux des zombies, routes des allumeurs, points de réparation et badges d'interface.
- Le château tire lui-même sur les zombies qui l'atteignent (garde du château).
- Cohésion des hordes corrigée : un zombie isolé loin de sa meute n'est plus bloqué.

## Phase 22 — Ressources portées, gisements en grappes, feux de la plaine
- **Icônes des ressources** redessinées en vectoriel (rondins, bloc de pierre, lingots de fer, gerbe de blé, pièces d'or), partout dans l'interface (`.ri-*` dans style.css, `RES_INFO.ico`).
- **Charges modélisées** (src/render/Loads.js) : fagot de rondins et sac de grain sur l'épaule, blocs de pierre tenus à deux mains, paniers d'osier de minerai de fer ou de pépites d'or ; posées aussi dans les brouettes et charrettes.
- **Animations de portage** recalculées (tools/bake_villager.py) : portage devant (bras fléchis) et portage à l'épaule (une main tient la charge, l'autre balance). Pendant le portage, l'**outil est rangé dans le dos** (matrice du buste par image).
- **Gisements** : petits blocs de minerai (3 variantes par ressource) multipliés en grappes de 22 ; la grappe se vide bloc par bloc quand on l'exploite.
- **Feux de la plaine** : 8 bûchers devant la muraille. Hors assaut et de jour, l'**équipe des feux** (tâche dédiée) charge des fagots aux tas de bois de la cour et monte les bûchers ; à l'approche de la nuit, elle les allume (grand feu, lumière large, 260 s). Les zombies dispersent les bûchers et éteignent les feux.
- **Savoir-faire des allumeurs** (Université, 3 niveaux) : +25 % de vitesse, feux plus longs, −15 % de bois par niveau.

## Phase 23 — Châtelets, grande porte, réglages graphiques, église et prêtre
- **Châtelets** : la salle au-dessus de chaque herse porte le même parement que la muraille (modèle « dungeon_wall »), sur un cœur de pierre sombre.
- **Grande porte centrale** : passage et herse plus hauts (6,2 m contre 4,4 m), châtelet plus haut (`GATE_HS`, `GATE_TH` dans WallView.js).
- **Graphismes ajustables en cours de partie** (☰ Paramètres → Graphismes) : préréglage Téléphone / Tablette / Ordinateur, puis ombres, lueurs, herbe dense, haute résolution ; enregistré avec la partie (`sim.gfx`).
- **Église** : plus d'église posée d'office. Bâtiment à construire (3 niveaux, petit cimetière au niv. 2, calvaire doré et jardin au niv. 3).
- **Prêtre** (src/sim/priest.js) : arrive quand l'église est bâtie. Hors assaut, il reste devant l'église ; pendant l'alerte et l'assaut, il va prier derrière le secteur le plus menacé.
  - niv. 1 : Bénédiction (archers et tours du secteur +15 %, +5 %/niveau) et Familles (+8 places de population par niveau)
  - niv. 2 : Exorcisme (lumière sacrée toutes les 8 s sur les zombies proches, +50 % contre les golems)
  - niv. 3 : Sanctuaire (zombies ralentis près de lui, escouades voisines soignées)

## Phase 24 — Morsures, geôle, transformation
- **Morsures** (src/sim/infection.js, `INFECTION`) : un combattant tué par un zombie « mordeur » (classique, rapide, résistant, briseur) peut être **mordu** au lieu de mourir — mordu debout ou **plaqué au sol** (plongeon). Le lourd et le golem tuent sans mordre ; le **colosse déchire** sa proie en deux et boit son sang.
- **À terre, le mordu est vulnérable** : les zombies proches se ruent dessus pour le dévorer (ses camarades le protègent tant qu'ils sont à côté). L'**odeur du sang** attire de plus loin vers les escouades blessées.
- **Geôle** (bâtiment, 3 niveaux, 4 cellules par niveau) : relevé, le mordu boite jusqu'à la geôle et s'y enferme ; chaque niveau retarde la transformation de 30 %. Transformé en cellule, il est abattu par les gardes.
- **Le prêtre** est le seul à pouvoir guérir un mordu (4 s de soin) : il retourne en réserve.
- **Transformation** (45 s) : hors de la geôle, le mordu devient un zombie (teinte de sa tunique) et peut **surprendre** un voisin et le mordre à son tour, ou être repoussé.
- **Animations** : morsure debout (le zombie se penche et happe), plongeon (il se jette à l'horizontale), coup du lourd, déchirement et boisson du colosse ; mordus couchés qui se débattent, puis voûtés et de plus en plus verdâtres ; gerbes et gouttes de sang.
- Onglet Armée : alerte « mordus » (compte à rebours, ce qu'il manque) ; fiche de la geôle : cellules, mordus et bilan.

## Phase 25 — Grande porte, menus en deux temps, gestion des escouades
- **Grande porte centrale** vraiment plus haute (passage 8,6 m contre 4,4 m) : pas de chemin de ronde au-dessus, châtelet sur toute l'épaisseur du mur ; les archers du secteur central se placent de part et d'autre de la porte.
- **Menus en deux temps, partout** : chaque onglet s'ouvre sur une grille de **catégories** (tuiles avec icône, résumé, compteur, alerte), puis un **sous-menu** avec « ‹ Retour ».
  - ⚒ Bâtir : Habitations · Ressources · Stockage · Militaire · Soins et foi (infirmerie, église, geôle) · Ville et savoir · Défense
  - 🛡 Armée : Escouades · Recruter · Rangs · Magie · Siège · Forge
  - 👥 Villageois : Récolte · Défrichage et feux · Réparations · Prospection
  - 📜 Savoir : Améliorations du village · Où améliorer quoi ?
- **Escouades** : liste (état, santé) → fiche d'une escouade, ordres groupés par intention : 1 · Où l'envoyer (Combattre dehors, Rentrer, Placer à la main, ou garder un secteur sur un plan de la muraille) · 2 · Comment combattre (formation, Tenir / Charger) · 3 · Effectif.
- **Ordres explicites** : toucher la carte ne déplace plus une escouade par surprise. On choisit l'action (bulle sur la carte : Combattre / Déplacer / Ordres), un bandeau en haut indique quoi toucher, annulable.

## Phase 26 — IA de l'armée
- **Archers** (src/sim/armyai.js) : les archers en réserve montent d'eux-mêmes sur les remparts et se répartissent selon la menace ; pendant l'assaut, l'IA en déplace un à la fois vers le secteur le plus pressé. Un placement manuel (fiche d'un secteur) coupe l'IA des archers ; réactivable dans Armée › Escouades.
- **Escouades sans ordre (🤖)** : gardent le secteur qui en a le plus besoin (menace, brèche, intrus, muraille abîmée), avec de l'inertie pour ne pas courir partout ; restent à leur poste si elles sont très blessées ; cavaliers, chevaliers et lourds en forme font de **courtes sorties** contre un petit groupe au pied du mur (jamais contre un géant), puis rentrent blessés ou quand le danger est passé ; formation et posture choisies selon la situation.
- **Un ordre du joueur rend l'escouade manuelle (✋)** ; « Rendre la main à l'IA » la remet en automatique. Badges 🤖 / ✋ dans la liste et la bulle.

## Phase 27 — Escouades autonomes, formation après la vague, placement, plus de codes de secteur
- Symboles : escouade **⚜ autonome** (sans ordre) / **📯 tes ordres**.
- **Après chaque vague**, les troupes en réserve complètent les escouades autonomes puis forment de nouvelles escouades (`army.autoForm`).
- **Placement avant la vague** : bandeau « Vague repoussée · place tes troupes » → mode placement (jeu en pause) : toucher une escouade, puis l'endroit voulu (cour = poste, devant la muraille = attend sur le champ). Aussi depuis Armée › Escouades.
- **Plus de AG / CG / C / CD / AD** : ni lettres ni lignes peintes sur le terrain ; les pastilles de muraille (sans code) n'apparaissent que sur un pan abîmé ou attaqué ; on parle des repères (porte gauche, mur gauche, grande porte, mur droit, porte droite) ; le choix « garder un secteur » disparaît au profit du placement à la main.

## Phase 28 — Escouade, peloton, escadron · production animée · vue pivotante
- **Organisation des troupes** (`GRADES`) : escouade 15 hommes, peloton 50, escadron 150. Une troupe ne se forme qu'au complet ; moins de 15 hommes d'une catégorie restent en réserve.
- **Fusionner** dès qu'il y a assez d'hommes de la même catégorie (troupes en garnison + réserve) ; **séparer** en pelotons ou en escouades (le reste de moins de 15 rentre en réserve). Après chaque vague, les escouades autonomes fusionnent en pelotons, les pelotons en escadrons, et la réserve forme le plus grand grade possible.
- Formations proposées quelle que soit la taille (aussi dans la bulle sur la carte) ; les gros effectifs prennent plus de rangs ; postes de garnison espacés selon la taille.
- **Production d'unités** : la fiche d'une caserne / écurie / champ de tir montre l'unité en formation (4 étapes animées, barre de progression, file, boutons +1) ; dans la scène, des recrues s'exercent devant le bâtiment (épée contre mannequins, tir sur cibles avec flèches, cavaliers en carrière).
- **Vue pivotante** : bouton 🧭 (ou touche R) pour regarder vers le sud (village, château) ou vers le nord (muraille, horde), avec rotation animée.

## Phase 29 — Golem zombie à la masse, sol haute qualité, zone de quarantaine, archers vigilants
- **Golem** redessiné en géant zombie de chairs recousues (voûté, peau gris-vert, côtes à nu, coutures, haillons, chaînes de forçat, petite tête à la mâchoire pendante), armé d'une **énorme masse** cerclée de fer et cloutée : il l'élève au-dessus de la tête puis l'abat sur la muraille, ou **écrase les troupes** (impact au sol, poussière, sang, secousse).
- **Sol haute qualité** (src/render/Ground.js) : textures de détail procédurales répétées à l'échelle du mètre — herbe (brins), terre (grain, cailloux, fissures), pavés (galets jointoyés) — mélangées dans le shader selon une carte de répartition ; toute la carte en herbe et terre, la cour derrière la muraille, le tour du château et la placette en pavés. Les parcelles de forêt utilisent les mêmes textures.
- **Zone de quarantaine** (ex-geôle) : enclos grillagé (maille de fer, barbelés, portail, cabane et garde, panneau rouge et blanc), **fixe**, tout à gauche de la placette où attend la réserve, présente dès le début ; améliorable (4 places par niveau).
- **Archers vigilants** : hors assaut, les 3 archers les plus proches tirent sur un soldat transformé en zombie ; pendant une vague, ils restent concentrés sur la horde.
- Garde-fou : `node tools/check-comments.mjs` repère le code avalé par un commentaire.

## Phase 30 — Temps calme / vague, château fort, file d'entraînement géante
- **Deux moments** : *Temps calme* (on bâtit, recrute, prépare) puis *Alerte* et *Vague en cours* — les chantiers se mettent en **pause** pendant l'alerte et l'assaut. Bandeau à chaque changement de moment ; temps calme allongé (120 s au départ, 75 s ensuite).
- **Zombies** : pas traînant au loin (×0,55), puis **course soudaine** (×1,7, corps penché) à moins de 42 m de la muraille ; l'animation suit la vitesse.
- **Herse centrale** : passage de 20 m (deux herses), même hauteur que les autres portes.
- **Caserne** : symbole dessiné (écu rouge, épées croisées) dans l'interface et sur l'enseigne.
- **Pose de bâtiment** : Échap ou clic droit pour quitter ; correction du clic perdu (barre réécrite pendant l'appui) et du pointeur fantôme de la souris.
- **Château fort** procédural : enceinte crénelée, quatre tours rondes à toits coniques, châtelet à herse, donjon à échauguettes, logis, puits.
- **Lisières** : l'herbe déborde en touffes irrégulières sur la terre et les pavés ; bord déformé par un bruit dans le shader.
- **Entraînement** : file de 30 (+20 par niveau), 3 / 5 / 8 unités formées **en même temps** selon le niveau, boutons +1 / +5 / +15.

## Phase 31 — Bordure de carte, rythme, maisons à 4 niveaux, interface épurée
- **Rythme** : chantiers ×2,6 plus rapides ; on bâtit, recrute et produit **à tout moment**, vague comprise ; 5 min avant la 1re vague, ~3 min entre les suivantes.
- **Zombies** : chaque horde a sa propre distance de charge (12 à 105 m), chaque zombie s'en écarte, quelques isolés chargent n'importe quand ; allure lente et course très variables. Couloirs d'arrivée tirés au hasard sur tout le nord, dont 30 % par le centre ; hordes tantôt serrées, tantôt éparpillées. Le centre nord n'a plus de forêt.
- **Bordure** : crête de collines et de rochers autour de la zone jouable, évasée vers le nord au-dessus du couloir des hordes ; sol de sous-bois au-delà, forêt de bordure derrière la crête seulement.
- **Forêts** : essences cohérentes (sapinière au nord, feuillus au sud-ouest, bois de feuillus à l'est) avec lisières progressives ; neige qui s'estompe peu à peu vers le sud.
- **Maisons** : 4 niveaux (15 / 37 / 67 / 105 places), modèles dédiés (chaumière, colombages à étage, grande maison à lucarne, maison de notable à tourelle).
- **Archers** : montent sur la muraille dès leur formation, tant qu'il y a de la place et que le secteur n'est ni percé ni franchi.
- **Portes** : à hauteur de muraille ; seule la herse levée (et ses rails) dépasse. Correction : les herses n'étaient plus affichées (ligne avalée par un commentaire, le garde-fou détecte désormais ce cas).
- **Interface** : pause ❚❚/▶ séparée de la vitesse (1× · 2× · 3×), « ⚔ Lancer » explicite, bandeau de vague sans compte à rebours précis (barre de répit), ressources compactes (12.4k), deux messages au plus.
- **Villageois manquants** : petite pastille discrète (silhouette + nombre) au-dessus des ateliers aux places libres et des chantiers en manque d'ouvriers.

## Phase 32 — Géant zombie humain
- L'ancien « golem » devient un **homme mort-vivant géant** : anatomie humaine en formes arrondies (proportions réalistes, tête ≈ 1/7), dos voûté, tête tendue en avant qui hoche et se rejette à l'élan, peau livide marbrée d'ecchymoses, côtes à nu, plaies, crâne entaillé, mâchoire décrochée, cheveux épars, haillons de chemise et braies, pieds nus. Il garde sa massue de chêne cerclée de fer.

## Phase 33 — Finitions
- Bouton de vue : symbole de caméra qui pivote (plus de boussole).
- Herbe harmonisée : mêmes teintes sur la carte, au-delà de la crête et sur les parcelles défrichées ; variations en grandes nappes douces, sous-bois et collines fondus, plus de vignettage aux bords.
- Vitesse : 1× → 2× → 4× → 8× (jusqu'à 24 pas de simulation par image).
- Plus de cubes de niveau au-dessus des bâtiments.
- Gisements cliquables (forêt des bûcherons, carrière, filons de fer et d'or, gisements découverts) : nature du minerai, quantité restante / initiale, ouvriers, temps avant épuisement, total restant ; rappel du stock restant dans la fiche des mines, carrières et scieries.

## Phase 34 — Bâtiments qui grandissent, morts au sol, dallage du chemin de ronde
- Chaque niveau agrandit physiquement le bâtiment : aile latérale et parvis (niv. 2), tour carrée crénelée et seconde aile (niv. 3), flèche dorée, bannières et bornes (niv. 4), faîtes dorés, oriflammes et lanternes (niv. 5), seconde tour (niv. 6).
- Fiche d'un bâtiment : encadré « Au niveau N : » avec les gains chiffrés (emplacements, rendement, stocks, rang et vitesse d'entraînement, unités débloquées, plafonds, soins, routes, pouvoirs du prêtre, places…) et le nouvel aspect.
- Les zombies tués tombent (en avant ou en arrière), gisent ~4 s puis s'effacent en transparence (1,2 s) ; instancié, coût négligeable.
- Chemin de ronde : dallage de pierre taillée procédural haute qualité (rangs décalés, biseaux, fissures, éclats, mousse dans les joints, usure au passage).

## Phase 35 — Scierie, Travaux publics, routes
- Symbole dessiné de la scierie (lame de scie circulaire sur une bille), interface et enseigne.
- Correction : le bâtiment des Travaux publics n'avait aucun modèle (invisible) — dépôt de voirie modélisé (halle à colombages, gravier, pavés, rouleau, brouette, outils, borne, poteau indicateur).
- Routes refaites : Sentier → Terre battue → Gravier → Pavés. Centre texturé à l'échelle du mètre (pavés de même taille sur toutes les largeurs) + bordures dédiées à bord irrégulier et fondu (galets, pierres taillées, herbe) ; les routes d'origine sont recouvertes dès la terre battue, hors cour et placette.

## Phase 36 — Qualité du rendu
- Tonalité filmique ACES (exposition 1,12), lumières de ciel bleutée / sol chaud réajustées.
- Ombres de contact : une tache douce sous chaque combattant (positions issues des Rigs), chaque archer sur la muraille, chaque zombie, villageois et cadavre.
- Dôme de ciel en dégradé (jour / nuit), brume du nord bleu ardoise, perspective aérienne (le lointain pâlit vers l'horizon) ; brumes appliquées avant la tonalité.
- Vent : balancement des sapins de bordure, de la forêt des bûcherons et des forêts vierges (en plus de l'herbe).
- Post-traitement maison (qualité Haute, option « Relief et halo ») : occlusion ambiante SSAO demi-résolution lissée + halo (bloom) plus fort la nuit ; composition ACES + sRGB identique au rendu direct.

## Phase 40 — Grand lot v4.0 (36 points)
- **Rendu** : douves en eau autour du château (pont-levis) et douves défensives ; poussière et traces des hordes qui chargent ; bannières qui flottent, fumées de cheminées ; lumière de fin de journée (soleil rasant) et fenêtres éclairées la nuit ; taches de sang qui s'effacent.
- **Vie** : soldats et géants qui tombent puis s'effacent ; villageois assis sur la placette, enfants qui jouent, charrettes sur les routes pavées ; oiseaux qui s'envolent à l'approche des hordes, cerfs qui fuient.
- **Jeu** : événements entre les vagues (marchand, caravane et mercenaires, réfugiés — dont un mordu parfois —, incendie) ; boss « Seigneur pourri » toutes les 10 vagues ; bilan de fin de vague ; 13 succès.
- **Confort** : mini-carte (cliquable), 3 emplacements de sauvegarde + reprise au début de la vague, tutoriel guidé en 6 étapes.
- **Défense** : pièges (fosse à pieux, chausse-trappes, baril de poix), huile bouillante par secteur, douves (fossé → eau → pieux), palissade de première ligne, météo (pluie, brouillard, neige) aux effets réels.
- **Zombies** : grimpeur, cracheur d'acide, gonflé (explose), chiens en meute ; hordes qui visent le secteur le plus faible, plus nombreuses la nuit ; zombie dans le village = villageois mordus.
- **Économie** : saisons (récoltes, hiver et bois de chauffage), moral (production, chantiers, fêtes), métiers spécialisés (charpentier, boulanger, forgeron).
- **Progression** : capitaine nommé (niveaux, cri de ralliement, mort définitive), recherches (Alchimie, Ingénierie, Poudre noire → canon), médailles d'escouade après 10 vagues.
- **Modes** : survie (classement), défi du jour (2 modificateurs tirés de la date), campagne en 3 missions.
- **Immersion** : musique dynamique (luth au calme, tambours à l'alerte, tambours + cuivres pendant la vague), cloche d'alarme, gémissements selon la horde, cris des capitaines, vue à la première personne depuis un archer.
- Demandes en cours de route : niveaux graphiques Faible / Moyen / Élevé (réglages avancés repliés) ; transitions d'herbe et de touffes encore plus douces ; nuit ≈ 1/10e du cycle ; trajets des hordes variés (dérive par horde, serpentement par zombie).

## Phase 41 — Herbe et poussière
- Poussière des hordes fortement réduite (1 zombie sur 5, rare, voile léger ; traces au sol plus rares).
- Nouvelles touffes d'herbe : 9 brins courbés (base sombre → pointe claire), teintées par la couleur exacte du sol sous elles, éclairées comme le sol (plus jamais noires), légère ondulation au vent ; placées selon la part d'herbe du sol (raréfaction progressive vers la terre et les pavés, aucune sur les chemins).

## Phase 42 — Douves et ruisseau réalistes
- Douves au tracé naturel : rectangle arrondi aux bords irréguliers, largeur variable, eau claire et verdâtre près des rives, sombre au centre, reflet du ciel en incidence rasante, ondulations douces.
- Berges en pente (boue mouillée → terre → herbe), galets, touffes de roseaux qui ondulent au vent, nénuphars ; pont-levis en planches avec poteaux et chaînes face à la porte.
- Ruisseau qui s'échappe des douves vers l'est en serpentant jusqu'à la forêt, avec courant visible ; son tracé est réservé (aucun bâtiment dessus).
- Sécurité : les zombies isolés qui traînent 3 min après la dernière horde s'épuisent, la vague ne reste plus bloquée.

## Phase 43 — Lisibilité du combat
- Aperçu de la vague : touche « Vague » pour voir la composition attendue (types, nombre, ce que fait chaque ennemi), les nouveaux ennemis en rouge, le butin et un conseil de défense. Alerte quand de nouveaux ennemis apparaissent.
- Flèches au bord de l'écran vers les secteurs attaqués, percés ou visés hors champ (clic → la caméra y va et ouvre la fiche).
- Raccourcis clavier : Espace pause, 1-4 vitesse, B bâtir, T armée, V villageois, K savoir, H aide.
- Le tutoriel se cache pendant l'alerte et la vague.

## Phase 44 — Cour du rempart et nuits lisibles
- Cour intérieure vivante au pied de la muraille : tonneaux, caisses, bottes de foin, râteliers de lances et boucliers, piles de bûches (jamais devant les escaliers ni les portes).
- Grandes bannières bleues et or sur la face intérieure du mur.
- Braseros de part et d'autre des portes : flamme qui vacille et halo doux au sol la nuit.
- Nuit au clair de lune : lumière bleutée plus présente, le champ de bataille reste lisible.

## Phase 45 — Barres de vie des géants et revenus
- Barres de vie au-dessus des colosses, golems et du boss ; grande barre du Seigneur pourri en haut de l'écran.
- Revenu par minute affiché sous chaque ressource (écrans larges) ; toucher une ressource donne stock / capacité, revenu, nombre de travailleurs et, pour la nourriture, la consommation.
- Halo de menace rouge adouci (dégradé) qui suit l'arc de la muraille ; plus de rectangle rouge visible à travers la grande porte.

## Phase 46 — Mini-carte et confort mobile
- Mini-carte refaite : fond tiré du vrai sol (routes, terre battue), douves et ruisseau en bleu, château et tours, muraille colorée par état, bâtiments à l'échelle (chantiers en transparence), escouades, hordes et géants qui pulsent, champ de vision réel de la caméra.
- Téléphone : le tutoriel passe en bas de l'écran (la mini-carte reste visible) et remonte quand un panneau est ouvert ; la barre du boss évite la mini-carte.
- Pendant la vague : barre rouge de la horde restante et compteur de zombies abattus (💀) dans le bandeau.
- Usure de la cour : passages polis devant les portes, flaques, mousse au pied du mur.
- Barre du château qui change de couleur (vert → orange → rouge), flash et alerte quand il est frappé.
- Fantôme de placement éclairé (on voit la forme du bâtiment) ; sur téléphone le tutoriel ne passe plus sous la barre de placement.
- Lancer la vague en avance rapporte de l'or (dès la vague 2), proportionnel au temps de préparation sacrifié ; le bonus s'affiche sur le bouton « Lancer ».
- Bandeau de vague plus robuste sur téléphone (texte tronqué proprement, barres jamais écrasées).
- Conseiller 💡 au-dessus du dock : les 3 actions les plus utiles du moment (famine, secteur visé sans archer, brèche, population pleine, villageois sans travail, stock plein, muraille abîmée sans réparateurs, pas de champ de tir), chacune avec un raccourci direct.
- Tutoriel : l'étape « répartis tes villageois » (déjà faite au départ) devient « recrute des villageois ».
- Ombres de nuages qui glissent lentement sur le paysage le jour.

## Phase 47 — Guide du défenseur
- Menu ☰ › « 📖 Guide du défenseur » : les bases (calme / alerte / vague), conseils clés, bestiaire complet (PV, vitesse, dégâts à la muraille, rôle) et raccourcis clavier.
- Les zombies s'éclairent brièvement quand une flèche, un boulet ou un coup les touche : on voit où frappe la défense.
- Flammes des braseros refaites (langues croisées lumineuses) et torches sur le chemin de ronde qui s'allument à la tombée de la nuit : la muraille se dessine dans le noir.
- Noms de secteurs harmonisés partout (Porte gauche, Mur gauche, Grande porte…) ; le bilan n'affiche plus de « secteur le plus meurtrier » quand aucun zombie n'a été abattu.
- Pastille dorée ⬆ au-dessus des bâtiments qu'on peut améliorer tout de suite (ressources suffisantes), pendant le temps calme ; un clic ouvre la fiche.
- Compte à rebours de la prochaine vague dans le bandeau (🌿 2:30, puis 🔔 Ils arrivent 8s).
- Champ de bataille au nord : arbres morts, charrettes renversées, lances et épées plantées, ossements, pieux brisés, bannières rouges déchirées, et des corbeaux qui s'envolent en tournoyant quand une horde approche.

## Phase 48 — Objectifs
- Après le tutoriel, une chaîne de 8 objectifs concrets avec récompense (tour, maison niv. 2, 15 archers, muraille renforcée, escouade, vague 5, université, vague 10). Affichés pendant le temps calme, réductibles en une pastille 🎯 ; progression enregistrée avec la partie.
- Réglage « Aides à l'écran » (menu ☰) pour masquer conseils, objectifs et pastilles ⬆ ; les objectifs continuent de compter en arrière-plan.
- Vague repoussée : gerbes d'étincelles dorées au-dessus du château.
- Robustesse : la boucle de jeu est replanifiée avant chaque image (une erreur ponctuelle ne fige plus la partie) ; correctif d'un index de monture des cavaliers qui pouvait déborder après une vague.
- Forge redessinée : murs de pierre claire, colombages, toit d'ardoise à deux pans, fenêtre rougeoyante.
- Les corbeaux croassent en s'envolant (son synthétisé).
- Pluie enfin visible : 1 400 gouttes en traits inclinés qui tombent autour de la vue, petites éclaboussures au sol, arrivée et départ en fondu.

## Phase 49 — Saisons visibles
- L'hiver blanchit le paysage : neige en nappes irrégulières sur le sol, les toits, les remparts et tout ce qui regarde le ciel, arrivée et fonte progressives ; une chute de neige pose aussi un léger voile blanc en toute saison.
- L'automne roussit l'herbe (teinte dorée irrégulière) ; les sapins restent verts.
- Bannières et torches du rempart tombent avec leur tronçon quand une brèche s'ouvre (plus d'objets flottant dans le vide) et reviennent à la réparation.
- Lucioles les nuits douces au-dessus des prés du village (ni en hiver ni sous la pluie).
- Conseiller : signale les archers en réserve à placer quand le placement automatique est coupé.
- Écran de défaite : record de vague (🏅 nouveau record), bouton « Reprendre au début de la vague » directement sur l'écran, aides masquées.
- Tutoriel : le bouton à toucher est entouré d'un halo doré qui pulse (dock, catégorie, bâtiment, puis « Poser »).
- Une cane et ses canetons, et quelques canards, glissent sur les douves ; l'eau des douves est désormais opaque (les pavés ne se voyaient plus au travers).
- Crépuscule doré : soleil orangé plus présent, horizon orangé et zénith mauve, sol réchauffé.
- Bords de l'écran rouges et pulsants quand une brèche est ouverte ou que le château passe sous 50 %.
- Robustesse : index d'animation des villageois borné, charges portées sans modèle ignorées.
- Sons : fanfare de cuivres et cloche quand une vague est repoussée, pièces qui tintent pour le bonus de lancement anticipé.
