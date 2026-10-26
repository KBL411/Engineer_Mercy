# Engineer Mercy

**Un assistant de recherche d'emploi qui tourne sur ta machine, dans Claude Code. Fork francophone de [career-ops](https://github.com/career-ops-hq/career-ops), pensé pour les profils data, plateforme et IA qui cherchent à Paris.**

> ## 🤝 Tu veux ajouter ta pierre à l'édifice ?
>
> Les contributions sont les bienvenues. Pour proposer une modification, **ouvre une demande de fusion** (*pull request*) :
>
> 1. fais un fork du dépôt, puis crée une branche (`git checkout -b ma-modification`) ;
> 2. fais ta modification et lance les tests : `node test-all.mjs` ;
> 3. ouvre la *pull request* vers ce dépôt, avec deux lignes qui disent ce que tu changes et pourquoi.
>
> Trois règles : **aucune donnée personnelle** dans un commit (ni CV, ni profil, ni offres suivies, ni clé d'API), **jamais d'envoi automatique** de candidature, et un correctif ou une fonction **accompagnés d'un test** quand c'est possible. Une idée, un bug, une question : ouvre une *issue*.

## Sommaire

- [C'est quoi ?](#cest-quoi-)
- [D'où ça vient](#doù-ça-vient)
- [Ce qui change par rapport à career-ops](#ce-qui-change-par-rapport-à-career-ops)
- [Ce qui arrive bientôt](#ce-qui-arrive-bientôt)
- [Tutoriel : de zéro à ta première offre évaluée](#tutoriel--de-zéro-à-ta-première-offre-évaluée)
- [Utilisation](#utilisation)
- [Ce que l'outil ne fait pas](#ce-que-loutil-ne-fait-pas)
- [Tes données restent chez toi](#tes-données-restent-chez-toi)
- [Licence et crédits](#licence-et-crédits)

## C'est quoi ?

Tu colles une offre d'emploi. L'outil, sur ta machine :

- vérifie qu'elle est encore ouverte ;
- la note de 1 à 5 face à **ton** CV et à **ce que tu cherches** (rapport détaillé en blocs A-H) ;
- te déconseille de postuler quand l'adéquation est faible ;
- prépare un CV adapté, une lettre de motivation et des réponses aux questions du formulaire ;
- garde le suivi de toutes tes candidatures.

| Garantie | Ce que ça veut dire |
|---|---|
| **Humain dans la boucle** | L'IA évalue et recommande, tu décides et tu agis. L'outil ne soumet jamais de candidature : c'est toi qui appuies sur « Envoyer ». <!-- hitl: absolute guarantee. Ne jamais ajouter de nuance du type « en général », « par défaut » ou « sans ton accord » en retouchant cette ligne. --> |

En plus, il peut scanner chaque jour les sites de recrutement des entreprises, **sans consommer de tokens**, puis trier et évaluer seulement les offres qui valent le coup.

## D'où ça vient

Ce dépôt est un **fork** de [career-ops](https://github.com/career-ops-hq/career-ops), créé par [Santiago Fernández de Valderrama (@santifer)](https://github.com/santifer) et publié sous licence MIT. Notre point de départ est la **v1.37.0**.

C'est un *hard fork* : on ne fusionne pas le projet d'origine, qui bouge très vite (plus de 4 900 issues et PR). Une fois par semaine, on relit ce qui est arrivé en amont et on reprend à la main, commit par commit, ce qui nous concerne (correctif d'un connecteur qu'on utilise, faille de sécurité, amélioration du scanner). Aucun code d'origine n'entre sans avoir été lu. Le détail est dans [`SPEC.md`](SPEC.md), section 3.1.

Un grand merci à l'équipe d'origine : tout le moteur d'évaluation, le scanner, la génération de PDF et le suivi des candidatures viennent de leur travail.

## Ce qui change par rapport à career-ops

| Sujet | career-ops d'origine | Ce fork |
|---|---|---|
| **Cible** | Marché mondial, 18 langues | **France, surtout Paris**, CDI chez un client final ; profils data, plateforme et IA. Français et anglais |
| **Agent IA** | Une dizaine de CLI (Codex, Gemini, OpenCode, Qwen…) | **Claude Code uniquement** |
| **Mises à jour** | `update-system.mjs` met à jour le projet en un clic | **Canal coupé** : le remote `upstream` est en lecture seule, revue hebdomadaire et reprise commit par commit |
| **Mode batch** | Les agents tournent avec `--dangerously-skip-permissions` | **Enveloppe de permissions minimale** : plus aucune permission ouverte en grand, voir ci-dessous |
| **Sources d'offres** | Plus de 100 entreprises, surtout anglo-saxonnes | Sites de recrutement d'entreprises (Greenhouse, Lever, Ashby, Workable, SmartRecruiters, Teamtailor) et **Welcome to the Jungle** filtré côté serveur (CDI, Île-de-France ou full remote) |
| **Lieu des offres** | — | Le connecteur Welcome to the Jungle ajoute **la région du bureau** au lieu de l'offre, pour filtrer correctement |
| **Annonces Welcome to the Jungle** | Lecture de la page | Lecture via l'index de recherche public du site (la page est derrière un pare-feu qui bloque les lectures automatiques) |
| **Clients finaux** | — | Une **liste noire** (`data/blacklist.md`) écarte les ESN, cabinets et agences pour ne garder que les clients finaux |
| **Exécution quotidienne** | Rien de prévu | `scripts/daily-run.sh` : scan, tri, évaluation des meilleures offres, rapport du jour (10 évaluations par jour au plus, réglable) |
| **LinkedIn** | — | **Aucune automatisation** (ses conditions d'utilisation l'interdisent). À la place : l'export officiel `Connections.csv` croisé hors ligne avec les entreprises scannées, et le mode `contacto` pour rédiger un message envoyé à la main |

### Le lanceur sécurisé

Le mode batch lance des agents Claude qui lisent des offres venues d'Internet : une offre piégée peut contenir des instructions cachées. Dans ce fork, `batch/batch-runner.sh` enferme chaque agent :

- ni réglages ni hooks de l'utilisateur, fichiers limités au dossier de travail ;
- seulement quatre outils : lecture, écriture, Bash et recherche web ;
- tout ce qui n'est pas explicitement autorisé est refusé, sans question posée ;
- écriture permise seulement dans `reports/`, `output/` et `batch/tracker-additions/` ;
- refus explicites : lecture de `.env`, `curl`, `wget`, `node -e`, outils MCP.

`scripts/test-prompt-injection.sh` vérifie l'enveloppe avec une offre piégée. Sur nos essais, l'agent ne tente rien d'interdit et signale l'injection dans le rapport ; quand on le force à essayer, les 8 actions interdites testées sont refusées et les actions permises passent.

### Et l'élagage ?

Le dépôt contient encore beaucoup de fichiers hérités (autres CLI, traductions, connecteurs d'autres pays, tableaux de bord, Docker, Nix…). Ils seront supprimés par catégories, une phase à la fois. En attendant, ils ne sont ni maintenus ni testés pour ce fork : n'en dépends pas. La feuille de route complète est dans [`SPEC.md`](SPEC.md).

## Ce qui arrive bientôt

### 🥋 DataDojo : s'entraîner sur ses faiblesses

Le but : que l'outil ne se contente pas de te dire « il te manque Kubernetes », mais t'aide à le combler.

- **Détection des faiblesses.** Les lacunes de toutes tes évaluations sont agrégées (c'est déjà le rôle de `upskill.mjs`), puis comparées à ce que tu vises. Une offre mal notée pèse plus qu'une offre bien notée.
- **Défis progressifs.** Chaque lacune devient une série de défis courts (SQL, Python, architecture, AI engineering, DevOps…) dont la difficulté monte avec ton niveau, avec une révision espacée pour que ça reste en tête.
- **Entraînement aux entretiens techniques.** Des simulations chronométrées, sans aide, corrigées à la fin, sur ce qui tombe vraiment en entretien Data et AI engineer.

DataDojo est un projet compagnon, en cours de développement. Le lien est prévu par un export `data/skill-gaps.json` que le jeu lira en lecture seule.

### ✉️ Des lettres de motivation prêtes avant ta candidature

Pour chaque offre qui passe le seuil, une lettre rédigée en français, appuyée sur ton CV et tes propres histoires (jamais sur des chiffres inventés), prête à relire avant l'envoi.

### 📄 Un CV refait pour chaque candidature

Pour chaque offre, un CV réordonné et reformulé pour coller au poste : mêmes faits, mis en avant différemment. Les mots-clés de l'offre sont repris quand ils sont vrais, jamais ajoutés quand ils ne le sont pas. Une vérification en code bloque tout PDF dont un chiffre ou un fait ne figure pas dans ton CV d'origine.

### Aussi au programme

- un **rapport quotidien** court (nouvelles offres au-dessus du seuil, note, raison en une phrase) ;
- un **rapport hebdomadaire** complet : classement des offres, fourchettes de salaire réelles, compétences les plus demandées face à ton niveau, relances à faire ;
- les **tâches planifiées Windows** pour tout lancer seul chaque matin ;
- l'**élagage** du dépôt, jusqu'à ce que `node test-all.mjs` et `node doctor.mjs` restent verts sur le strict nécessaire.

## Tutoriel : de zéro à ta première offre évaluée

Compte une vingtaine de minutes. Tu peux t'arrêter après l'étape 5 et reprendre plus tard.

### 1. Ce qu'il te faut sur ta machine

| Outil | Pourquoi | Vérifier |
|---|---|---|
| [Node.js](https://nodejs.org) 22.13 ou plus | fait tourner les scripts | `node --version` |
| [Git](https://git-scm.com) | récupère le projet | `git --version` |
| [Claude Code](https://claude.com/claude-code) et un compte Claude | l'assistant qui fait l'évaluation | `claude --version` |

Sous Windows, ouvre un terminal **WSL** ou **Git Bash** : les scripts `.sh` n'ont pas besoin d'autre chose. Détails dans [`docs/WINDOWS.md`](docs/WINDOWS.md).

### 2. Récupère le projet

```bash
git clone https://github.com/KBL411/Engineer_Mercy.git
cd Engineer_Mercy
npm install
npx playwright install chromium   # pour générer les PDF
```

La *skill* `/career-ops` est déjà dans le dépôt (`.claude/skills/career-ops/`) : Claude Code la charge tout seul quand tu l'ouvres dans ce dossier. Il n'y a rien à installer pour elle.

### 3. Ajoute les outils qui rendent l'assistant meilleur

**Playwright MCP, recommandé.** Il permet à Claude d'ouvrir une offre dans un vrai navigateur pour vérifier qu'elle est encore en ligne. Dans Claude Code :

```
/plugin install playwright@claude-plugins-official
```

**Firecrawl, facultatif.** Certaines pages d'offres refusent les lectures automatiques (Welcome to the Jungle répond « 403 » à un simple téléchargement) ou n'affichent leur texte qu'avec du JavaScript. Firecrawl les lit quand même. Il faut un compte gratuit sur [firecrawl.dev](https://www.firecrawl.dev) (1 000 crédits par mois, une page = 1 crédit).

```bash
npm install -g firecrawl-cli
firecrawl login                        # colle ta clé d'API quand il la demande
firecrawl setup core -g -a claude-code # installe les skills Firecrawl pour Claude Code
export CAREER_OPS_FIRECRAWL=1          # active-le pour les évaluations en lot
```

Firecrawl ne sert qu'en **dernier recours** : l'outil essaie d'abord les moyens gratuits. Il reçoit seulement l'URL de l'offre, jamais ton CV. LinkedIn est refusé d'office. Sans `CAREER_OPS_FIRECRAWL=1`, il ne se déclenche jamais dans le mode lot.

### 4. Vérifie l'installation

```bash
npm run doctor
```

Chaque ligne doit commencer par ✓. Un ⚠ n'est pas bloquant (par exemple « Playwright MCP non détecté » tant que tu n'as pas fait l'étape 3). Un ✗ dit quoi corriger.

### 5. Prépare ton CV

Deux façons, au choix.

**A. Tu déposes tes documents, l'assistant s'en sert.** Copie-les dans `documents/` :

| Dossier | Quoi |
|---|---|
| `documents/cv/` | ton CV actuel, en `.pdf` (avec texte), `.md`, `.txt` ou `.tex` |
| `documents/linkedin/` | l'export PDF de ton profil LinkedIn (« Enregistrer au format PDF ») |
| `documents/diplomas/` | relevés de notes, diplômes |

Un `.docx` n'est pas lu : exporte-le d'abord en PDF. Puis, dans Claude Code, tape `/career-ops intake`. Il te propose ce qu'il comprend de tes documents, et **n'écrit rien sans ton accord**.

**B. Tu écris `cv.md` toi-même**, à la racine du projet, dans ce format (les titres comptent, c'est comme ça que les outils retrouvent tes postes) :

```markdown
# CV -- Prénom Nom

**Lieu :** Paris
**Email :** prenom@example.com
**LinkedIn :** linkedin.com/in/ton-profil

## Résumé

Deux ou trois phrases sur ce que tu fais et ce que tu cherches.

## Expérience

### Nom de l'entreprise -- Paris

**Intitulé du poste**
2022-2025

- Ce que tu as fait, avec un chiffre quand tu en as un
- Un autre résultat concret

## Formation

- Master en informatique, Université X (2020)

## Compétences

- **Données :** SQL, Python, dbt, Snowflake
- **Infra :** Docker, Terraform, Airflow
```

Le titre de la section doit être `## Expérience` ou `## Experience` (ou `## Work Experience`), chaque poste commence par `### Entreprise -- Lieu`, puis une ligne en gras pour l'intitulé, puis les dates. Un modèle complet est dans [`examples/cv-example.md`](examples/cv-example.md).

### 6. Lance l'assistant et réponds à ses questions

```bash
claude
```

À la première phrase que tu écris, il détecte qu'il manque ton profil et te guide par la conversation. Réponds en français, en phrases simples. Il te demande :

1. ton nom, ton e-mail, ta ville ;
2. les postes que tu vises (« Data Engineer », « Platform Engineer », « AI Engineer »…) ;
3. ta fourchette de salaire ;
4. le niveau de dépense par évaluation : *économie* (rapide, peu cher), *standard* (le bon choix par défaut) ou *premium* (le plus soigné) ;
5. ce qui te distingue, ce qui t'enthousiasme, ce qui t'épuise ;
6. tes critères éliminatoires (« pas d'ESN », « pas de présentiel 5 jours », « pas de Java »…) ;
7. ta plus belle réussite professionnelle, celle par laquelle tu ouvrirais un entretien.

Tes réponses vont dans `config/profile.yml`, `modes/_profile.md` et `cv.md` : ce sont des fichiers **à toi**, ignorés par Git. Plus tu es précis, meilleure est la note des offres. Tu peux revenir les corriger quand tu veux, en le demandant à l'assistant.

### 7. Évalue ta première offre

Dans Claude Code, colle simplement l'URL d'une offre :

```
https://www.welcometothejungle.com/fr/companies/.../jobs/...
```

Au bout de quelques minutes tu obtiens :

| Quoi | Où |
|---|---|
| le rapport complet (blocs A-H) avec la note sur 5 | `reports/` |
| un CV adapté à l'offre, en PDF | `output/` |
| la ligne de suivi de ta candidature | `data/applications.md` |

Sous 4,0/5, l'assistant te déconseille de postuler. Tu relis, tu corriges, et c'est **toi** qui envoies.

### 8. Laisse-le chercher pour toi

```
/career-ops scan
```

parcourt les sites de recrutement configurés dans `portals.yml` et met les nouvelles offres dans `data/pipeline.md`. `/career-ops pipeline` les évalue ensuite une à une. Pour tout enchaîner chaque matin sans y penser, voir [Les offres du jour](#les-offres-du-jour-sans-y-penser).

Pour ajouter des entreprises, demande simplement : « ajoute Doctolib et Alan à mes portails ».

### Un souci ?

| Symptôme | À faire |
|---|---|
| `/career-ops` n'existe pas | ouvre `claude` **dans le dossier du projet**, pas ailleurs |
| `npm run doctor` affiche ✗ | lis la ligne : elle dit quoi corriger |
| Une offre n'est pas lue (403, page vide) | active Firecrawl (étape 3), ou colle le texte de l'offre dans la conversation |
| Les notes te semblent fausses | dis-le à l'assistant (« trop haute, j'ai de l'expérience en dbt ») : il corrige ton profil |

## Utilisation

Colle simplement l'URL ou le texte d'une offre : l'outil évalue, génère le rapport et le PDF, puis ajoute la ligne au suivi. Les commandes les plus utiles :

| Commande | Ce qu'elle fait |
|---|---|
| `/career-ops` | liste toutes les commandes |
| `/career-ops {offre}` | évaluation complète : rapport, PDF et suivi |
| `/career-ops scan` | cherche les nouvelles offres sur les sites configurés |
| `/career-ops pipeline` | traite les offres en attente dans `data/pipeline.md` |
| `/career-ops triage` | premier tri rapide avant l'évaluation complète |
| `/career-ops pdf` | CV adapté à une offre |
| `/career-ops cover` | lettre de motivation |
| `/career-ops contacto` | trouve la bonne personne à contacter et rédige le message |
| `/career-ops interview-prep` | prépare un entretien pour une entreprise donnée |
| `/career-ops upskill` | carte pondérée des compétences qui te manquent |
| `/career-ops tracker` | état de tes candidatures |
| `/career-ops followup` | relances à faire |

Le fonctionnement détaillé (modes, états du suivi, règles d'intégrité) est décrit dans [`AGENTS.md`](AGENTS.md), et la liste des scripts dans [`docs/SCRIPTS.md`](docs/SCRIPTS.md).

### Les offres du jour, sans y penser

```bash
bash scripts/daily-run.sh
```

Le script enchaîne scan, tri, évaluation des meilleures offres et rapport. Le rapport tombe dans `data/daily-reports/AAAA-MM-JJ.md`. Réglages par variables d'environnement : `DAILY_COUNT` (évaluations par passage, 10 par défaut), `DAILY_MIN_RANK` (note de tri minimale, 3,8), `DAILY_RANK_LIMIT` (offres triées par passage, 60) et `DAILY_PARALLEL` (agents en parallèle, 3).

## Ce que l'outil ne fait pas

- **Envoyer une candidature.** Il rédige chaque champ, tu relis et tu cliques toi-même.
- **Envoyer un e-mail.** Brouillons seulement.
- **T'espionner.** Pas de télémétrie, pas de serveur : ton CV va de ta machine au fournisseur d'IA que tu as choisi, et nulle part ailleurs.
- **Te pousser à postuler sous 4,0/5.** Il te le déconseille. Tu peux passer outre, il le notera.
- **Inventer.** Il reformule ton CV, il ne le fabrique pas. Il ne s'attribue aucun projet que tu n'as pas écrit. Relis tout de même chaque CV avant de l'envoyer : le contrôle en code ne juge pas toutes les reformulations.

Le principe : peu de candidatures, bien ciblées, plutôt qu'une pluie de CV.

## Tes données restent chez toi

Tes fichiers personnels sont **ignorés par Git** : `cv.md`, `config/profile.yml`, `modes/_profile.md`, `portals.yml`, `data/`, `reports/`, `output/`, `jds/`, `interview-prep/`, `.env`. Ne les ajoute pas de force (`git add -f`) et ne les colle jamais dans une *issue* ou une *pull request*.

Les clés d'API vont dans `.env` (copie `.env.example`), écrites à la main, jamais collées dans une conversation.

## Licence et crédits

- Code sous licence [MIT](LICENSE), copyright de Santiago Fernández de Valderrama pour career-ops, conservé tel quel dans ce fork.
- Le nom « career-ops » et son identité visuelle appartiennent à leur auteur ([`TRADEMARK.md`](TRADEMARK.md)). Ce fork ne prétend à aucun lien officiel avec le projet d'origine.
- Fork maintenu par [@KBL411](https://github.com/KBL411).
- Cet outil t'aide à candidater, il ne remplace pas ton jugement. Voir [`LEGAL_DISCLAIMER.md`](LEGAL_DISCLAIMER.md).
