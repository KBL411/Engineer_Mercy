# Gmail : alertes emploi et brouillons de candidature

Deux usages facultatifs, indépendants, chacun avec son propre jeton :

| Usage | Ce que ça fait | Droit demandé à Google | Jeton dans `.env` |
|---|---|---|---|
| **Alertes** | lit les e-mails d'alerte emploi d'une étiquette Gmail et en tire les liens d'offres | lecture seule | `GMAIL_REFRESH_TOKEN` |
| **Brouillons** | enregistre l'e-mail de candidature **dans tes Brouillons Gmail**, CV et lettre en pièces jointes | création de brouillons | `GMAIL_DRAFT_REFRESH_TOKEN` |

**Rien n'est jamais envoyé.** Tu relis le brouillon dans Gmail et c'est toi qui cliques sur « Envoyer ». Google n'a pas de droit « brouillons seulement » (le droit de créer des brouillons permet techniquement d'envoyer aussi). La promesse est donc tenue dans le code : aucun fichier Gmail du projet ne contient de route d'envoi, et `tests/gmail-draft.test.mjs` échoue si on en ajoute une.

Compte une quinzaine de minutes pour la première fois. Tu n'as besoin de faire l'étape 1 à 3 qu'une fois pour les deux usages.

## 1. Créer ton propre accès Google

Le projet n'a pas d'accès Google partagé : tu crées le tien, il ne sert qu'à toi. Les noms des menus de Google changent de temps en temps, cherche l'équivalent si besoin.

1. Va sur la [console Google Cloud](https://console.cloud.google.com) et crée un projet (par exemple « career-ops »).
2. Dans **APIs et services**, active l'**API Gmail**.
3. Configure l'**écran de consentement OAuth** : type **Externe**, un nom d'application, ton adresse e-mail. Ajoute ton adresse Gmail comme **utilisateur test**.
4. **Passe l'application en production** (« Publier l'application »). Sans ça, Google invalide ton jeton au bout de 7 jours. Tu es le seul utilisateur : l'avertissement « application non vérifiée » qui s'affichera est normal (**Avancé**, puis **Accéder à career-ops**).
5. Dans **Identifiants**, crée un **ID client OAuth** de type **Application de bureau** (*Desktop app*). Garde l'ID client et le code secret.

## 2. Mettre l'ID client dans `.env`

Ouvre le fichier `.env` à la racine du projet (copie `.env.example` si besoin) et ajoute, **à la main** :

```
GMAIL_CLIENT_ID=ton-id-client.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=ton-code-secret
```

`.env` est ignoré par Git. Ne colle jamais ces valeurs dans une conversation, une issue ou une pull request.

## 3. Récupérer ton jeton

Selon l'usage que tu veux (tu peux faire les deux, l'un après l'autre) :

```bash
node gmail-auth.mjs --scope readonly --write   # alertes  -> GMAIL_REFRESH_TOKEN
node gmail-auth.mjs --scope compose --write    # brouillons -> GMAIL_DRAFT_REFRESH_TOKEN
```

Le script affiche un lien Google. Ouvre-le, choisis ton compte, accepte. Le jeton est ajouté à ton `.env` (sans `--write`, il s'affiche et tu le colles toi-même). Rien d'autre n'est écrit ni affiché.

## Usage A : les alertes emploi

1. Dans Gmail, crée une étiquette **Job Leads** et un filtre qui l'applique à tes alertes emploi (LinkedIn, Indeed, APEC, Welcome to the Jungle : cherche leur adresse d'expéditeur, puis **Filtrer les messages comme ceux-ci**, **Appliquer le libellé**).
2. Active le plugin :
   ```bash
   cp config/plugins.example.yml config/plugins.yml   # une seule fois
   ```
   puis dans `config/plugins.yml` :
   ```yaml
   plugins:
     gmail: { enabled: true, label: "Job Leads", days_back: 7 }
   ```
3. Lance la lecture : `node plugins.mjs run gmail`. Les nouveaux liens vont dans `data/pipeline.md`, sans doublon. Seuls les e-mails dont l'expéditeur est authentifié (DMARC) sont lus, pour qu'un faux e-mail ne glisse pas un lien piégé.
4. Puis `/career-ops pipeline` évalue ces offres comme les autres.

## Usage B : les brouillons de candidature

Avec `GMAIL_DRAFT_REFRESH_TOKEN` en place, dans Claude Code :

```
/career-ops email 42
```

L'assistant rédige l'e-mail, te le montre, puis te propose de l'enregistrer en brouillon. Si tu acceptes, il écrit le texte dans `output/email-….txt`, vérifie le brouillon à blanc, l'enregistre dans Gmail avec le CV et la lettre de `output/` en pièces jointes, et te donne le lien vers tes Brouillons. Tu relis, tu corriges, tu envoies.

À la main, c'est la même commande :

```bash
node gmail-draft.mjs --to recrutement@exemple.fr --subject "Candidature Data Engineer" \
  --body-file output/email-exemple.txt --attach output/cv-exemple.pdf --attach output/lettre-exemple.pdf
```

Ajoute `--dry-run` pour voir ce qui serait enregistré sans toucher à Gmail. Règles de sécurité : un seul destinataire (une adresse simple), pas de retour à la ligne dans l'objet, fichiers uniquement sous `output/` et seulement `.pdf`, `.docx` ou `.txt`, 15 Mo au plus.

## Garder la main

- **Retirer l'accès** à tout moment : [myaccount.google.com/permissions](https://myaccount.google.com/permissions), puis supprime la ligne du `.env`.
- Les jetons ne sont écrits que dans ton `.env`, jamais dans un rapport ni dans Git.
- Le mode lot (`batch/batch-runner.sh`) n'a aucun accès à Gmail : les agents y sont enfermés. Les brouillons se font en séance interactive.

## Dépannage

| Message | Cause probable |
|---|---|
| `invalid_grant` | jeton révoqué, ou application restée en mode test (7 jours) : repasse l'étape 1.4 puis refais l'étape 3 |
| `Google n'a pas renvoyé de refresh token` | l'accès existe déjà : retire-le sur [myaccount.google.com/permissions](https://myaccount.google.com/permissions) et recommence |
| `403` / `insufficient scope` à l'enregistrement du brouillon | le jeton vient de `--scope readonly` : refais `--scope compose` |
| `GMAIL_DRAFT_REFRESH_TOKEN doivent être dans ton .env` | étape 3 non faite pour les brouillons |
| le plugin ne trouve aucune offre | l'étiquette est vide, mal nommée, ou `days_back` trop court |
