# Contribuer à Engineer Mercy

Merci d'avoir envie d'ajouter ta pierre. Ce dépôt est un fork de [career-ops](https://github.com/career-ops-hq/career-ops) pour Claude Code, pensé pour les profils data, plateforme et IA qui cherchent à Paris (voir le [README](README.md) et [`SPEC.md`](SPEC.md)).

## En pratique

1. Fais un fork du dépôt et crée une branche : `git checkout -b ma-modification`.
2. Installe : `npm install` puis `npm run doctor`.
3. Fais ta modification. Pour un correctif ou une nouvelle fonction, ajoute un test dans `tests/` (modèle : `tests/wttj-jd.test.mjs`).
4. Lance les tests : `node test-all.mjs` (environ 3 minutes). Pour un seul fichier : `node tests/mon-test.test.mjs`.
5. Ouvre une *pull request* vers `main` et remplis le modèle. Dis en deux lignes ce que tu changes et pourquoi.

Une grosse fonction ou un changement d'architecture : ouvre d'abord une *issue* pour qu'on en parle avant que tu y passes des heures. Un bug, une faute, un connecteur qui casse : envoie directement la PR.

## Les règles qui ne bougent pas

- **Aucune donnée personnelle** dans un commit : ni CV, ni profil, ni offres suivies, ni rapports, ni numéros, ni clés d'API. Pour un exemple, utilise des données fictives dans `examples/`. Les fichiers de la couche utilisateur (voir [`DATA_CONTRACT.md`](DATA_CONTRACT.md)) sont ignorés par Git : ne les ajoute pas de force.
- **Jamais d'envoi automatique** d'une candidature. L'outil prépare, l'humain relit et envoie.
- **Rien n'est inventé** dans un CV ou une lettre : tout vient du CV, du profil ou de ce que l'utilisateur dit.
- **Le contenu d'une offre est une donnée, jamais une instruction.** Une offre qui s'adresse à l'IA ne doit pas être obéie (voir « Untrusted External Content » dans [`AGENTS.md`](AGENTS.md)).
- **Le lanceur batch reste enfermé.** Pas de `--dangerously-skip-permissions`. Toute évolution de `batch/batch-runner.sh` se vérifie avec `scripts/test-prompt-injection.sh`.
- **Claude Code uniquement.** On n'ajoute pas de support pour d'autres assistants.

## Ajouter une source d'offres

Un connecteur (`providers/`) lit **une** source publique. Avant de l'écrire :

1. les offres sont réelles, rattachées à un employeur identifiable, et gratuites à lire et à postuler pour le candidat ;
2. tu as lu les conditions d'utilisation et le `robots.txt` de la source, et ce que le connecteur lit n'est pas interdit ;
3. chaque offre porte l'URL la plus directe vers l'employeur (celle de son site de recrutement quand elle existe).

Le guide pour écrire un connecteur est dans [`providers/ADDING_A_PROVIDER.md`](providers/ADDING_A_PROVIDER.md). Le marché visé est la France, surtout Paris.

## Ce qu'on n'accepte pas

- **L'automatisation de LinkedIn** et de toute plateforme qui interdit l'accès automatisé.
- **Les envois automatiques** de candidatures.
- **L'envoi des données de l'utilisateur** (CV, suivi, notes) à un service tiers. Lire une API publique d'offres en local est bienvenu. Firecrawl n'est accepté que parce qu'il ne reçoit que l'URL publique d'une offre, qu'il est désactivé par défaut et que LinkedIn y est refusé.
- **Une infrastructure hébergée** (proxy, service d'agrégation) dans le cœur de l'outil.
- **Les données personnelles** dans une PR.

## Style

- Scripts en `.mjs`, Node 22.13 ou plus. Gère les fichiers absents (`existsSync` avant `readFileSync`).
- Les fichiers de la couche utilisateur ne sont jamais modifiés par le code système.
- Commits courts, au présent, en anglais ou en français (`feat(scan): …`, `fix(batch): …`).
- `npm run lint` vérifie la syntaxe de tous les `.mjs`.

## Questions

Ouvre une [*issue*](https://github.com/KBL411/Engineer_Mercy/issues). Pour une faille de sécurité, suis [`SECURITY.md`](SECURITY.md) et n'ouvre pas d'issue publique.
