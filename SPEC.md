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
| 4. Sources payantes ou publiques | Adzuna mesuré : non retenu. France Travail : API retirée du libre accès. Liste noire enrichie de 18 ESN et cabinets vus dans les résultats d'Adzuna (129 entrées) | ✅ 19/10 |
| 5. Lanceur sécurisé | `batch/batch-runner.sh` lance ses agents dans une enveloppe de permissions minimale au lieu de `--dangerously-skip-permissions` ; `batch-tailor.mjs` est désactivé ; `scripts/test-prompt-injection.sh` vérifie l'enveloppe (voir 3.5) | ✅ 19/10 |

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
| Adzuna | ❌ mesuré le 19/10, non retenu | Payante : 8 £ par mois. Mesure avec 6 des 25 appels d'essai (Paris, CDI, 7 jours, 6 types de poste) : 75 offres passent nos filtres. 3 étaient déjà dans nos sources et 2 autres aussi, sous un nom d'entreprise différent. Environ 68 viennent d'ESN, de cabinets de recrutement ou de sites qui republient leurs offres. Une seule offre nouvelle chez un client final dans la cible. Salaire publié pour 13 offres sur 75. L'apport ne justifie ni l'abonnement ni un connecteur |
| France Travail | ❌ non disponible (19/10) | L'API « Offres d'emploi » n'est plus en libre accès : data.gouv.fr la classe « restreinte », retirée après des « usages automatisés massifs » par des solutions d'IA, et accessible seulement sur demande via le formulaire de contact. Un outil de recherche d'emploi piloté par une IA est précisément l'usage visé : on ne la demande pas. Les identifiants créés le 19/10 fonctionnent, mais ne donnent accès à aucune API utile |
| APEC, HelloWork | ⏳ | Pas d'API publique connue. Lire leurs conditions d'utilisation avant toute ligne de code |
| Free-Work, Collective.work, Forums Talents Handicap | ❌ | Vus à travers Adzuna le 19/10 : leurs offres CDI sont presque toutes des offres d'ESN ou de cabinets |
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

**Sécurité (en place le 19/10).** Jamais de `--dangerously-skip-permissions`. Chaque agent d'évaluation tourne dans l'enveloppe définie en tête de `batch/batch-runner.sh` (fonction `claude_worker_permission_args`) :
- `--restricted` : ni réglages ni hooks de l'utilisateur ou du projet, fichiers limités au dossier de travail ;
- `--tools` : lecture, écriture, Bash et WebSearch seulement ; pas de WebFetch, pas de sous-agents ;
- `--permission-mode dontAsk` et `--permission-prompts none` : tout ce qui n'est pas autorisé est refusé ;
- écriture permise seulement dans `reports/`, `output/` et `batch/tracker-additions/` ; Bash permis seulement pour `keyword-match.mjs`, `generate-pdf.mjs` (rendu sans JavaScript ni réseau), `salary-gap.mjs` et `date` ;
- refus explicites : WebFetch, MCP, lecture de `.env`, `node -e`, `curl`, `wget`. Le calcul facultatif de pouvoir d'achat en cas de relocalisation, qui passe par `node -e`, ne tourne donc plus en batch.

`batch-tailor.mjs` (CV adaptés en série) est désactivé : il enchaîne trop de scripts pour une liste blanche sûre. Les CV se génèrent en session interactive.

`scripts/test-prompt-injection.sh` vérifie l'enveloppe en l'extrayant du lanceur, pour tester exactement ce qui tourne :
- mode par défaut : une évaluation complète d'une offre piégée (ordres de lancer du code, d'écrire hors des dossiers permis, de modifier le profil, d'appeler une URL, de lire `.env`, de noter 5/5). Résultat du 19/10 sur Haiku : aucune tentative, injection signalée dans le rapport, note 3/5 ;
- `--attempt` : l'agent tente lui-même chaque action interdite, plus des actions permises servant de témoins. Résultat du 19/10 : 8 refus sur 8, témoins passés (écriture dans `reports/` et `output/`, script `node` autorisé, recherche web).

**Prérequis.** Le CLI `claude` doit être installé et dans le PATH : aujourd'hui, seul le binaire embarqué dans l'extension VS Code existe, sous un chemin qui change à chaque mise à jour de l'extension.

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
| 4 | Mesure d'Adzuna et de France Travail, puis leurs connecteurs s'ils apportent assez | Clés dans `.env` | ✅ 19/10 : aucun connecteur (Adzuna n'apporte presque rien, France Travail n'est plus accessible) |
| 5 | Lanceur headless sécurisé (liste blanche) et test d'offre piégée | — | ✅ 19/10 |
| 6 | Tri supervisé du stock de départ et mesure des tokens | Phase 5 | ⏳ |
| 7 | Rapports quotidien et hebdomadaire (dont la revue du projet d'origine), tâches planifiées Windows | Phase 6 | ⏳ |
| 8 | Lien DataDojo v1 | Phase 7 | ⏳ |
| 9 et suivantes | Élagage, une catégorie par phase | Phase 7 | ⏳ |

## 5. Questions ouvertes

Aucune au 18/10 : les cinq questions de la première version sont tranchées (sections 3.1, 3.5, 3.6, 3.8 et 3.4 pour Kiiro et Polynom).
