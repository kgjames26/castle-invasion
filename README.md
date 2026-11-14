# 🏰 Castle Invasion

Jeu de défense de base médiéval en 3D (PWA, mobile et ordinateur, portrait ou paysage).
Récolte des ressources comme dans Age of Empires, développe ta ville sur une seconde carte, forme tes troupes
et utilise des armes de siège pour protéger ta muraille contre des vagues de zombies venues du nord.

- **Three.js r170** + HTML/CSS/JS vanilla, modules ES, aucune étape de build
- **PWA installable** (manifest + service worker, jouable hors ligne)
- Three.js est fourni dans `lib/` (pas de CDN) → fonctionne hors ligne

## Le jeu

- La **muraille** coupe la carte en deux (15 segments de 8 m, porte au centre). Le **château** majestueux est au sud.
- Les **zombies arrivent du nord** depuis 3 nids. Vue inclinée vers le nord, pivotable (bouton boussole pour revenir au nord).
- **5 ressources** : 🪨 pierre, 🪵 bois, 🪙 or, ⛓️ métal, 💎 diamant. Les gisements rétrécissent puis disparaissent et libèrent une zone constructible (centre de récolte).
- **Cultivateurs** : récolte automatique (ou ciblée), retour au château / centre de récolte, fuite face aux zombies.
- **Ouvriers** : restent sous terre, accélèrent production/améliorations (+6 % chacun) et réparent la muraille entre les vagues.
- **Troupes** : soldats, archers (sur la muraille : +30 % de portée, hors d'atteinte au corps à corps), cavaliers (charge ×2).
- **7 formations** : Ligne, Double ligne, Coin, Carré, Escarmouche, Colonne, Cavalerie en coin (bonus selon le cahier des charges). Elles se brisent sous 40 % d'effectif.
- **Siège** : baliste, catapulte, trébuchet (tir parabolique, zone, munitions pierre ou métal), bélier mobile qui détruit les nids. Aperçu de portée et de trajectoire au placement.
- **Ennemis** : zombie, rapide, chien, golem, sauteur (franchit la muraille) + golem bélier et lanceur de rochers.
- **Carte « Ville »** (bouton au sud de la base) : Quartiers, Caserne, Écurie, Atelier de siège, Laboratoire (10 recherches), Forge, Marché, Défenses.
- **Sauvegarde** automatique toutes les 30 s et à chaque fin de vague (localStorage). Pause automatique en arrière-plan.

## Contrôles

| Mobile | Ordinateur |
|---|---|
| Toucher : sélectionner / donner un ordre | Clic gauche : sélectionner (glisser = cadre) |
| Glisser : déplacer la vue | Clic droit : déplacer / attaquer / récolter |
| Appui long + glisser : sélection multiple (ou bouton ▢ Cadre) | Molette : zoom · Q/E : rotation · clic molette : orbite |
| Deux doigts : zoom + rotation | WASD/ZQSD ou flèches : caméra |
| Double-toucher une unité : tout ce type à l'écran | Espace : pause · 1/2/3 : vitesse · B : base · G : former · X : dissoudre · M/T : déplacer/attaquer · N : vue nord |

## Lancer en local

Les modules ES exigent un serveur HTTP (pas `file://`) :

```bash
npm run dev          # = npx serve -l 5173 .
# ou
python3 -m http.server 5173
```

Puis ouvre http://localhost:5173

## Mettre sur GitHub (dépôt `castle-invasion`)

```bash
git init
git add .
git commit -m "Castle Invasion v1.0"
git branch -M main
git remote add origin https://github.com/<ton-compte>/castle-invasion.git
git push -u origin main
```

(Ou avec la CLI GitHub : `gh repo create castle-invasion --public --source . --push`)

## Déployer sur Vercel

1. Sur vercel.com : **Add New → Project**, importe le dépôt `castle-invasion`.
2. Framework Preset : **Other**. Build Command : *(vide)*. Output Directory : `.` (racine).
3. **Deploy**. Chaque `git push` sur `main` redéploie automatiquement.

En ligne de commande : `npx vercel` puis `npx vercel --prod`.
`vercel.json` règle le cache (service worker jamais mis en cache, assets 7 jours).

Après toute modification de fichiers, régénère la liste du cache hors ligne : `npm run sw`.

## Structure

```
index.html · manifest.json · service-worker.js · vercel.json
css/style.css
lib/                      Three.js r170 + GLTFLoader + BufferGeometryUtils
assets/models/medieval.glb  Modèles du château, tours, murailles, maisons… (allégés, couleurs intégrées)
assets/icons/             Icônes PWA
js/
  main.js                 Démarrage, menu, enregistrement du service worker
  data/Config.js          ⚖️ Tout l'équilibrage : unités, ennemis, siège, bâtiments, recherches, vagues
  core/                   Game.js (boucle fixe 60 Hz interpolée, sélection, ordres), SceneManager.js,
                          InputManager.js, SaveManager.js, CameraController.js, Instances.js, Audio.js
  entities/               Unit.js, Cultivator.js, Worker.js, Soldier.js, Cavalry.js, Enemy.js, SiegeWeapon.js
  formations/             Formation.js, FormationManager.js, FormationTypes.js
  systems/                ResourceSystem.js, WaveSystem.js, PathfindingSystem.js (A* + flow field),
                          CombatSystem.js, ProductionSystem.js, SiegeSystem.js, EffectsSystem.js
  ui/                     HUD.js, BaseUI.js, UndergroundUI.js, FormationUI.js, Tooltip.js, Minimap.js
  world/                  Map.js, Wall.js, ResourceNode.js, Building.js, Models.js (unités low-poly procédurales)
  utils/                  MathUtils.js, ObjectPool.js, Grid.js (grille 48×48 + hachage spatial)
scripts/generate-sw.mjs   Régénère la liste de cache du service worker
```

## Technique

- Grille de navigation **48×48** (cellules de 2,5 m) ; **A\*** à coûts dynamiques (gisements = coût élevé, brèches = coût réduit) avec lissage ; **flow field** (Dijkstra) pour les vagues, recalculé à chaque brèche/réparation.
- Unités, zombies, projectiles et particules rendus en **InstancedMesh** (un draw call par type) avec **pools d'objets**.
- Ombres uniquement sur unités, armes de siège, muraille et bâtiments ; HemisphereLight + soleil bas + torches ; brouillard exp2.
- LOD simple (accessoires masqués en vue lointaine), culling des modèles statiques.

## Pas encore inclus

- La **tour de siège** (optionnelle dans le cahier des charges).

## Crédits

- Modèles 3D : *Low poly winter medieval castle and town pack*, *Low poly medieval towers pack*, *Low poly medieval Walls pack* — **assetfactory** sur Sketchfab, licence *Sketchfab Standard* (voir `assets/models/LICENSE-*.txt`).
- Unités, zombies et armes de siège : modèles low-poly procéduraux du jeu.
- [Three.js](https://threejs.org) — licence MIT (`lib/THREE_LICENSE`).

## Version 2
- Jeu de jour ; carte : 3/5 zone de base (jusqu'à la muraille), 1/10 zone de placement des troupes et engins, 1/10 plaine, 1/5 brouillard progressif (sombre au nord).
- Format portrait (smartphone, automatique) ou paysage (PC / tablette) choisi dans le menu ; la carte est plus large en paysage.
- Zombies animés de tailles variées : plus ils sont grands, plus ils sont forts et résistants ; plus ils sont petits, plus ils sont rapides et fragiles.
- Archer avec tir de flèche animé.
