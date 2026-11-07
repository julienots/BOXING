# BOXING LEGEND — Rise to Immortality

Simulateur de carrière de boxe en 3D : vous êtes **entraîneur et manager**. Vous partez d'une salle délabrée, de 2 500 € et d'un boxeur catastrophique (note globale ≈ 15), et vous devez en faire la plus grande légende de l'histoire.

## Jouer

- **Le plus simple** : ouvrir `dist/index.html` dans un navigateur (Chrome, Edge, Firefox, Chrome Android). Fichier unique, hors-ligne, aucun serveur.
- **Développement** : `npm install` puis `npm start` → http://localhost:8080

Aucune API payante, aucun serveur externe : sauvegardes locales (3 emplacements + auto), export/import JSON.

## Ce qui est implémenté (et testé)

| Système | Contenu |
|---|---|
| **Combat** | Temps réel, vue **plongeante de côté** (angle fixe type retransmission, 3 cadrages). 6 coups (jab, direct, crochets, uppercuts) tête/corps, combinaisons nommées, contres, feintes, esquives, baisser la tête, recul, pivot, garde haute / au corps, clinch. Chaque coup : puissance, vitesse, précision, endurance, portée, risque de contre. Dégâts localisés (tête, mâchoire, corps, côtes, abdomen), crochet au foie, étourdissement, coupures, gonflements, knockdowns, compte de l'arbitre (se relever en martelant), KO, KO technique, arrêt médical, abandon, règle des 3 knockdowns, 3 juges (10 points), décisions unanime/partagée/majoritaire/nul. |
| **IA** | Modèle d'habitudes (chaîne de Markov sur vos coups, vos réflexes défensifs, votre rythme) : anticipe vos jabs, contre vos crochets, vise le corps si vous gardez haut, change de stratégie quand elle perd, accélère quand elle est menée, cherche le KO, gère son avance, survit quand elle est touchée. Elle **se souvient de vous** en cas de revanche. |
| **Modes de combat** | Boxer soi-même (clavier AZERTY/QWERTY ou tactile), coacher en direct (consignes), simulation rapide. Coin entre les rounds : état des boxeurs, analyse de l'adversaire, consignes, soigneur, jeter l'éponge. Ralenti cinématique des KO. |
| **Entraînement** | 22 exercices liés à 13 équipements, 14 attributs, programmes hebdomadaires éditables (3 séances/jour, intensité), modèles prêts à l'emploi, charge vs récupération, fatigue, blessures de surentraînement, rendement décroissant vers le potentiel, effet de l'âge, du staff, de la qualité du matériel, apprentissage de 10 techniques débloquant de vraies actions en combat. |
| **Gymnase 3D** | 5 niveaux de salle (du hangar à l'académie), équipements achetables/améliorables visibles et animés (sac lourd en pendule, poire, speed bag, ring, haltères, banc, machines, corde ondulatoire, mannequin, cardio, miroirs, récupération), confort. |
| **Carrière** | Amateur → pro → régional → national → continental → top 10 → top 5 → challenger → champion → unifié → incontesté → légende. 4 ceintures mondiales fictives, monde simulé (~70 boxeurs par catégorie qui combattent, progressent, vieillissent, prennent leur retraite), classements, offres de combat (prudentes, équilibrées, dangereuses et lucratives), négociation, combats de 3 à 12 rounds, revanches, rivalités, héritage. |
| **Manager** | Finances (loyers, salaires, cotisations, bourses, 30 % des bourses pro), staff (entraîneur adjoint, préparateur physique, kiné, cutman, nutritionniste, sparring, analyste vidéo), sponsors avec conditions, contrats promoteur, faillite. |
| **Événements** | Conférences de presse (ton respectueux/confiant/provocateur → engouement, motivation adverse, rivalité), pesée officielle (coupe de poids, sauna, amende), face-à-face, blessures pendant le camp, changement d'adversaire, offres de dernière minute, tournois amateurs, provocations, interviews, demandes du boxeur, invitations en camp d'élite, combats historiques. |
| **Santé & poids** | 17 catégories officielles (limites exactes, configurables), poids naturel, régimes, déshydratation, affaiblissement si coupe excessive, fatigue, moral, confiance, motivation, forme, blessures, dégâts chroniques. |
| **Personnalisation** | Éditeur : visage (mâchoire, menton, pommettes, arcades, nez, yeux, lèvres, oreilles), cheveux (9), barbe (6), peau, taille, allonge, musculature (qui augmente aussi avec la force réelle), épaules, torse, jambes, ventre, cicatrices, tatouages, garde, 11 styles, plusieurs tenues (gants, short, chaussures, bandages, protège-dents, peignoir, casque). |
| **Légendes** | 10 légendes **fictives** inspirées de styles (peek-a-boo explosif, mobilité/vitesse, défense épaule, combat rapproché agressif, technique polyvalente…). Aucun nom/apparence de boxeur réel. Mode exhibition + combats historiques en carrière. |
| **Arènes** | Petit club, gala amateur, salle régionale, grande arène, arena internationale, stade, championnat du monde, salle d'époque (filtre sépia). Public animé, flashs, écrans géants, faisceaux, arbitre, tabourets, ring complet. |

## Commandes (combat)

Déplacements relatifs à l'écran : **ZQSD / WASD / flèches**. Coups : **J** jab, **K** direct, **U** crochet avant, **I** crochet arrière, **N** uppercut avant, **M** uppercut arrière, **Maj** + coup = au corps. **Espace** (maintenir) garde haute, **B** garde au corps, **E** esquive, **X** baisser la tête, **V** recul, **R** pivot*, **C** clinch, **F** feinte*, **Tab** caméra, **Échap** pause. (* techniques à débloquer). Sur mobile : joystick + boutons.

## Technique

Choix de **Three.js (WebGL)** plutôt que Godot : le jeu doit pouvoir être construit et **testé automatiquement** dans cet environnement (Godot n'y est pas disponible), et le web tourne sur PC et Android sans installation. Modèles 3D 100 % procéduraux (géométrie sculptée paramétrique, squelette avec cinématique inverse bras/jambes, animation procédurale, ressorts d'impact), textures générées (ecchymoses, coupures, sueur dynamiques), sons synthétisés (Web Audio).

```
src/core     simulation (boxeur, entraînement, carrière, monde, événements, sauvegardes) — sans dépendance 3D
src/fight    moteur de combat, IA, juges, coups
src/render   rendu 3D (modèle, animateur, arènes, gymnase, vitrine)
src/ui       interface (hub, créateur, combat, entrées)
tests/       tests unitaires (npm test) et e2e navigateur (npm run e2e)
```

`npm test` : 14 tests dont une carrière simulée de 4 ans (≈40 combats, progression ≈15 → ≈58).

## Limites connues (honnêtes)

- Les personnages sont sculptés par code (pas de modèles d'artistes ni de motion capture) : rendu stylisé et crédible, pas photoréaliste.
- Les animations sont procédurales (IK) ; les poses d'entraînement les plus complexes (banc, machines) sont simplifiées.
- La voix de l'annonceur utilise la synthèse vocale du système si elle est disponible.
