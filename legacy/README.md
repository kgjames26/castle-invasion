# Ancien jeu (v2) — ressource de développement

Ce dossier contient le code source de l'ancienne version de Castle Invasion (v2). **Il n'est pas déployé** (voir `.vercelignore`) et ne fait pas partie du jeu actuel : il sert de bibliothèque d'idées et de code à réutiliser pour reconstruire certains éléments déjà développés.

Version complète et jouable (avec `lib/` et `assets/models/`) : branche GitHub **`claude/legacy-v2`**, tag local `legacy-v2-backup`. Les modèles lourds (`archer.bin`, `zombies.bin`, `medieval.glb`) sont aussi dans `assets/archive/` du jeu actuel.

## Où trouver quoi
| Sujet | Fichiers v2 (`legacy/v2/js/…`) | Remarques pour la réintégration |
|---|---|---|
| Animations | `world/AnimModels.js`, `world/Models.js`, `core/Instances.js` | Animation de zombies par texture de sommets (VAT) + instancing ; à brancher sur la Phase 6 (personnages) sans toucher à la simulation |
| Muraille | `world/Wall.js`, `systems/SiegeSystem.js` | Segments, brèches, réparation ; la v3 a déjà `sim/wall.js` : comparer le rendu (créneaux, tours, états de dégâts) |
| Zombies | `entities/Enemy.js`, `systems/WaveSystem.js` | Types, vagues, comportements ; la v3 a `sim/zombies.js` (SoA, flow fields) : reprendre les idées de variétés et d'animations |
| Archers | `entities/Soldier.js`, `entities/Unit.js`, `systems/CombatSystem.js` | Tir, portée, chemin de ronde ; v3 : `sim/army.js` (archers de garnison) |
| Villageois | `entities/Worker.js`, `entities/Cultivator.js`, `systems/ResourceSystem.js`, `world/ResourceNode.js` | Cycle de récolte / transport ; v3 : `sim/economy.js` |
| Cavalerie, siège | `entities/Cavalry.js`, `entities/SiegeWeapon.js` | Armes de siège et ingénieurs reportés en v3 (prochaines phases) |
| Formations | `formations/*` | Déjà repris en v3 sous forme d'escouades (`sim/army.js`) |
| Ville souterraine | `ui/UndergroundUI.js`, `world/City.js` | Idée à reprendre plus tard |
| Audio, minimap, caméra | `core/Audio.js`, `ui/Minimap.js`, `core/CameraController.js` | Disponibles si besoin |
