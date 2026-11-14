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
