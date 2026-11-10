# MediHub Frontend

Le dépôt contient deux applications connectées progressivement au backend Django MediHub :

- `staff/` : espace du personnel soignant et administratif, construit avec React et Vite.
- `patient-portal/` : portail patient construit avec Next.js.

## Installation et démarrage

Depuis la racine du dépôt :

```powershell
npm install
npm run dev:staff
```

Dans un autre terminal, lancer le portail patient :

```powershell
npm run dev:portal
```

Vite démarre généralement sur `http://localhost:5173` et Next.js sur `http://localhost:3000`.

## Connexion au backend

Le backend Django est configuré à `http://localhost:8000` par défaut. Les exemples de configuration se trouvent dans `staff/.env.example` et `patient-portal/.env.example`. Si l’adresse du backend change, la définir dans `VITE_API_BASE_URL` et `NEXT_PUBLIC_API_BASE_URL`.

Pour le développement local, autoriser les deux origines dans la configuration CORS/CSRF du backend et conserver `CORS_ALLOW_CREDENTIALS=True`. Les interfaces envoient les cookies de session; les requêtes d’écriture envoient le jeton `X-CSRFToken`.

## Portail patient

Le patient peut créer un compte ou se connecter avec son identifiant et son mot de passe, puis confirmer le téléphone avec le code reçu. Après authentification, il peut :

- consulter ses dossiers, son profil et ses documents pour chaque hôpital;
- choisir un hôpital, un médecin et un créneau, puis prendre rendez-vous;
- partager son résumé médical et les documents sélectionnés avec un autre hôpital après lecture du récapitulatif et consentement explicite.

Le backend crée un dossier local lors d’une première réservation dans un hôpital. Pour recevoir un partage, le dossier du patient doit déjà exister à l’hôpital destinataire : il faut donc y prendre rendez-vous avant de partager. Les codes SMS réels nécessitent la configuration du service d’envoi côté backend; le code simulé est disponible en mode démonstration. Le backend ne fournit pas encore de route de liste des rendez-vous pour le compte patient, donc l’interface présente la confirmation de réservation reçue.

## Espace du personnel

L’authentification du personnel utilise la session backend. Les dossiers patients, rendez-vous, consultations, admissions, prescriptions et résultats de laboratoire, stocks et ventes de pharmacie, factures et paiements sont lus ou enregistrés via les API MediHub et PostgreSQL, selon les rôles autorisés. La création d’un dossier patient enregistre aussi son numéro de téléphone séparément. Le rafraîchissement des modules relit les données du serveur après chaque écriture. La pharmacie est un établissement séparé : son compte propre est requis pour consulter ou gérer son catalogue et son stock.

## Compilation

```powershell
npm run build
```
