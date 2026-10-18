# Spec : career-ops, fork « France data »

Version du 18 octobre 2026. Ce fichier fixe ce qu'on construit, ce qui est décidé et ce qui reste à trancher. Il ne contient aucune donnée personnelle : celles-ci vivent dans les fichiers utilisateur ignorés par Git (`cv.md`, `config/profile.yml`, `modes/_profile.md`, `data/`, `interview-prep/`, `.env`).

Statuts : ✅ décidé · 🟡 proposé, à valider · 📏 à mesurer avant de décider · ⏳ à faire

## 1. Objectif

Un outil de recherche d'emploi pour un ingénieur data, plateforme ou IA qui cherche à Paris, en CDI, chez un client final. Il doit :

1. scanner chaque jour les offres, sans consommer de tokens ;
2. trier puis évaluer les offres pertinentes avec Claude, selon la grille de `modes/_profile.md` ;
3. produire un rapport quotidien court et un rapport hebdomadaire complet ;
4. transformer les compétences manquantes en entraînement dans DataDojo (`../jeu-code/`).

Base : career-ops v1.37.0 (licence MIT), utilisé avec Claude Code uniquement, en français et en anglais.

## 2. Déjà en place

| Phase | Contenu | État |
|---|---|---|
| Audit de sécurité | Pas de backdoor ni de télémétrie. Trois risques à traiter : le mode batch sans permissions, le canal de mise à jour, les plugins tiers | ✅ 17/10 |
| 1. Profil | `cv.md`, `config/profile.yml`, `modes/_profile.md` (grille de notation), `interview-prep/story-bank.md` (6 histoires) | ✅ 17/10 |
| 2. Sources | `portals.yml` (40 employeurs vérifiés, Welcome to the Jungle filtré côté serveur, 4 sites remote), `data/blacklist.md` (environ 110 ESN, cabinets, agences, recruteurs). `providers/wttj.mjs` : la région entre dans le lieu de l'offre. Scan d'essai : 172 offres retenues sur 4 211 | ✅ 18/10 |
| 3. Fork | Branche `fr-data`, remote `upstream` en lecture seule (push désactivé, suivi de `main`), canal de mise à jour coupé dans `AGENTS.md` et `modes/update.md`, `.env` préparé | ✅ 18/10 |

## 3. Décisions

### 3.1 Stratégie de fork ✅

**Un fork dur, avec une revue hebdomadaire du projet d'origine.** La branche `fr-data` part de v1.37.0. Le dépôt d'origine est le remote `upstream`, en lecture seule. On ne fusionne jamais `upstream/main` d'un bloc : le projet bouge très vite (plus de 4 900 issues et PR), et chaque fusion créerait des conflits sur les centaines de fichiers qu'on aura supprimés.

**La revue hebdomadaire** (décision du 18/10, pour rester à jour sur le projet d'origine) :
1. `git fetch upstream` ;
2. la liste des commits arrivés depuis la dernière revue qui touchent des fichiers que le fork possède encore ;
3. pour chacun, ce qu'il change et s'il nous concerne (correctif d'un connecteur qu'on utilise, faille de sécurité, amélioration du scanner ou de l'évaluation) ;
4. les commits retenus sont repris par `git cherry-pick`, un par un, avec l'accord explicite de Rayan.

Cette revue est une section du rapport hebdomadaire (3.6). Aucun code du projet d'origine n'entre sans avoir été lu : c'est aussi notre protection contre un code malveillant poussé en amont.

Fait le 18/10 :
- la section « Update Check » d'`AGENTS.md` interdit `update-system.mjs` et décrit cette revue ;
- `modes/update.md` renvoie vers cette revue ;
- le push vers `upstream` est désactivé.

Reste à faire lors de l'élagage (3.8) : supprimer `update-system.mjs` et les scripts `update`, `update:check`, `update:test` et `rollback` de `package.json`.

### 3.2 Périmètre ✅

- Agent : Claude Code uniquement. Les autres CLI (Gemini, Codex, Qwen, OpenCode, Kimi, Grok, Antigravity, Pi, Copilot) sont supprimés.
- Langues : français et anglais. Les autres traductions (README, `modes/<langue>/`) sont supprimées.
- Marché : France, et surtout Paris. Les connecteurs vers des sites d'emploi d'autres régions (Chine, Asie, Amérique latine, écoles américaines, défense allemande…) sont supprimés.

### 3.3 LinkedIn ✅

Aucune automatisation sur LinkedIn : ses conditions d'utilisation (section 8.2) interdisent les extensions et l'accès automatisé, et le risque est la fermeture du compte. À la place :

- **les relations** : l'export officiel `Connections.csv` dans `data/`, croisé avec les entreprises scannées par `linkedin-join.mjs` (hors ligne) ;
- **les inconnus** : le mode `contacto` trouve le bon contact par une recherche web et rédige le message, envoyé à la main ;
- **les offres** : la plupart sont copiées depuis le site de recrutement de l'entreprise, que le scanner lit déjà. Pour le reste, les alertes e-mail (voir 3.4) ;
- **en navigation** : on colle l'URL ou le texte d'une offre, career-ops l'évalue.

### 3.4 Sources

| Source | État | Note |
|---|---|---|
| Sites de recrutement des entreprises (Greenhouse, Lever, Ashby, Workable, SmartRecruiters, Teamtailor) | ✅ en place | 40 employeurs, identifiants vérifiés le 18/10 |
| Welcome to the Jungle | ✅ en place | CDI, Île-de-France ou full remote, filtré côté serveur |
| Sites remote (Remotive, Himalayas, We Work Remotely, Landing.jobs) | ✅ en place | Surtout américains : à retirer si le rapport montre qu'ils n'apportent rien |
| Adzuna | 📏 clé en cours de création | API gratuite (limites à vérifier sur le portail), agrège des offres françaises avec leur salaire |
| France Travail | 📏 facultatif | Peu de startups tech y publient. Son intérêt possible : les grands groupes, le secteur public, et les offres reçues de plus d'une centaine de sites partenaires (seulement celles que le partenaire autorise dans l'API) |
| APEC, HelloWork, Free-Work | ⏳ | Pas d'API publique connue. Lire leurs conditions d'utilisation avant toute ligne de code |
| Alertes e-mail (LinkedIn, Indeed, APEC) via le plugin Gmail | ⏳ plus tard | Demande une configuration OAuth Google |
| Hacker News « Who is hiring? » | ❌ retiré | Surtout américain, lieux illisibles |

**Règle de mesure, pour Adzuna et France Travail :** avant d'écrire un connecteur, un appel à la main avec la clé. On compte les offres Paris, CDI, data, plateforme ou IA de la dernière semaine que les sources en place n'ont pas. Si l'apport est faible, on n'écrit pas le connecteur.

**Liste noire.** Elle compare le nom exact de l'entreprise. Le secteur « Consulting / Audit » de Welcome to the Jungle ne peut pas servir de filtre : Mistral, Scaleway ou le ministère des Armées le déclarent aussi. Un cas douteux se tranche avec la présentation que l'entreprise publie sur Welcome to the Jungle (ainsi Kiiro et Polynom, ajoutés le 18/10).

### 3.5 Automatisation ✅

**Où.** Le Planificateur de tâches Windows, dans la session de l'utilisateur, avec Claude Code connecté au compte personnel. L'option « démarrer dès que possible » rattrape une exécution manquée quand le PC était éteint.

**Chaque jour, à 8 h :**
1. `node scan.mjs`, sans tokens. Les nouvelles offres vont dans `data/pipeline.md`.
2. Un tri léger (`modes/triage.md`), qui note chaque offre à partir d'un résumé compact du profil.
3. L'évaluation complète, seulement au-dessus du seuil de tri (`pipeline.triage_threshold`, 3,5 par défaut).
4. Le rapport quotidien.

**Sécurité.** Jamais de `--dangerously-skip-permissions`. Les évaluations tournent en `claude -p` avec une liste blanche d'outils (`--allowedTools`), limitée à la lecture des offres, l'écriture dans `reports/` et `data/`, et les scripts `node` du projet. Avant la mise en service, on teste avec une offre piégée : une annonce qui ordonne à l'agent de lancer une commande ou d'envoyer un fichier. Le test réussit si rien ne se passe.

**Budget.** Au plus 10 évaluations complètes par jour (décision du 18/10). On mesure les tokens réels d'une évaluation au premier lancement (`batch/aggregate-tokens.mjs`) ; le plafond se revoit avec ce chiffre.

**Stock de départ.** Les 172 offres du premier scan passent une fois par le tri, sous supervision, avant la première exécution planifiée.

### 3.6 Rapports ✅

**Quotidien, à 8 h**, quelques lignes : les nouvelles offres au-dessus du seuil, avec leur note et la raison en une phrase. Rien s'il n'y a rien.

**Hebdomadaire, le samedi à 10 h** (ni le mardi ni le jeudi, à la demande de Rayan) :
- le classement des offres de la semaine, avec leur note et le lien vers l'évaluation ;
- les fourchettes de salaire réelles des offres retenues, par type de poste ;
- les compétences les plus demandées, comparées aux trois niveaux du profil (maîtrisé, pratiqué, en apprentissage) ;
- les écarts récurrents, traduits en domaines DataDojo à travailler ;
- les entreprises où l'on a déjà une relation (`linkedin-join.mjs`) ;
- les relances à faire (`followup-cadence.mjs`) ;
- la revue du projet d'origine (3.1) : les commits proposés à la reprise.

**Format** : un fichier Markdown dans `reports/`, plus une page HTML locale à ouvrir dans le navigateur, et une notification Windows quand le rapport est prêt. L'e-mail viendra avec le plugin Gmail.

### 3.7 Lien avec DataDojo 🟡

`upskill.mjs` agrège déjà les lacunes de toutes les évaluations en une carte pondérée : une offre mal notée pèse plus qu'une offre bien notée.

- **v1** : le rapport hebdomadaire traduit cette carte en domaines DataDojo (table de correspondance dans `modes/_profile.md`). Le lien reste manuel.
- **v2** : un export `data/skill-gaps.json`, que DataDojo lit en lecture seule pour prioriser ses révisions. Cela demande une évolution du jeu, à faire dans une session dédiée à `jeu-code/`.

Règle absolue : career-ops n'écrit jamais dans `jeu-code/data/`.

### 3.8 Élagage ✅

Après l'automatisation : la valeur d'abord, le ménage ensuite. Une catégorie par phase, dans cet ordre :

1. les autres CLI ;
2. les langues autres que le français et l'anglais ;
3. les connecteurs hors marché ;
4. la vitrine du projet (manifeste, « hired wall », sponsors, presse), Docker, Nix, la CI GitHub, release-please ;
5. le système de mise à jour (`update-system.mjs`, ses tests et ses scripts npm) ;
6. les deux tableaux de bord, `web/` (Next.js, 520 fichiers) et `dashboard/` (Go) : la page HTML du rapport les remplace (décision du 18/10).

Chaque phase supprime aussi les tests du code retiré, et adapte les tests d'intégrité qui exigent des fichiers ou sections supprimés. Elle se termine quand `node test-all.mjs` et `node doctor.mjs` sont au vert.

### 3.9 Confidentialité ✅

- Les données personnelles restent dans les fichiers utilisateur ignorés par Git. Aucune ne va dans ce fichier ni dans un commit.
- Les clés d'API vont dans `.env` (ignoré par Git), écrites à la main, jamais collées dans une conversation.
- Les sessions de recherche d'emploi et l'automatisation tournent sur le compte Claude personnel.
- Si le fork devient public un jour : audit préalable (ni CV, ni `data/`, historique Git vérifié). Option plus visible qu'un fork : proposer le connecteur France Travail au projet d'origine, s'il est écrit.

## 4. Plan

Une phase = 5 fichiers modifiés au plus (les suppressions en masse d'une même catégorie comptent pour une seule opération), validée avant la suivante.

| Phase | Contenu | Prérequis | État |
|---|---|---|---|
| 3 | Mise en place du fork | — | ✅ 18/10 |
| 4 | Mesure d'Adzuna (et de France Travail), puis leurs connecteurs s'ils apportent assez | Clés dans `.env` | ⏳ |
| 5 | Lanceur headless sécurisé (liste blanche) et test d'offre piégée | — | ⏳ |
| 6 | Tri supervisé du stock de départ et mesure des tokens | Phase 5 | ⏳ |
| 7 | Rapports quotidien et hebdomadaire (dont la revue du projet d'origine), tâches planifiées Windows | Phase 6 | ⏳ |
| 8 | Lien DataDojo v1 | Phase 7 | ⏳ |
| 9 et suivantes | Élagage, une catégorie par phase | Phase 7 | ⏳ |

## 5. Questions ouvertes

Aucune au 18/10 : les cinq questions de la première version sont tranchées (sections 3.1, 3.5, 3.6, 3.8 et 3.4 pour Kiiro et Polynom).
