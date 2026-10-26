# Politique de sécurité

## Signaler une vulnérabilité

**N'ouvre pas d'issue publique pour une faille de sécurité.**

Utilise le signalement privé de GitHub : onglet **Security** du dépôt, puis **Report a vulnerability**. Donne :

1. la description de la faille ;
2. comment la reproduire ;
3. l'impact possible ;
4. un correctif, si tu en as un.

On corrige avant toute divulgation publique, et on te cite si tu le souhaites.

## Dans le périmètre

- **Scripts** (`*.mjs`, `batch/*.sh`) : injection de commande, traversée de chemin, SSRF ;
- **Lanceur batch** : toute évasion de l'enveloppe de permissions de `batch/batch-runner.sh` (voir `scripts/test-prompt-injection.sh`) ;
- **Modèles** (`templates/`) : XSS dans le HTML ou le PDF généré ;
- **Configuration** : fuite de secrets, réglages dangereux par défaut.

## Hors périmètre

- les failles de dépendances tierces (à signaler chez elles) ;
- les attaques qui demandent un accès physique à la machine ;
- l'ingénierie sociale ;
- une infrastructure hébergée : l'outil tourne en local, il n'y a pas de serveur à attaquer.

## Une faille dans le projet d'origine ?

Ce dépôt est un fork de [career-ops](https://github.com/career-ops-hq/career-ops). Si la faille existe aussi chez eux, signale-la à eux aussi, selon leur propre politique.
