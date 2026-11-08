# MediHub — interfaces frontend

Le frontend est organisé en deux applications indépendantes, conformément au rapport du projet :

- `staff/` : interface interne React + Vite pour le personnel de l’établissement.
- `patient-portal/` : portail patient Next.js, responsive.

Les deux interfaces fonctionnent actuellement sans backend. Les données sont de démonstration et restent dans l’état local du navigateur/session. Aucun appel réseau n’est effectué vers une API.

## Lancer l’interface du personnel

```powershell
cd staff
npm install
npm run dev
```

Vite affiche l’adresse locale, généralement `http://localhost:5173`.

## Lancer le portail patient

Dans un autre terminal :

```powershell
cd patient-portal
npm install
npm run dev
```

Le portail est généralement disponible sur `http://localhost:3000`. Pour ouvrir la session de démonstration, saisir un numéro d’au moins 8 chiffres puis le code `2468`.

## Raccordement ultérieur au backend

Les applications peuvent être reliées séparément à l’API Django/DRF. Les données d’exemple et les actions de démonstration devront alors être remplacées par des services d’API, avec gestion de session, CSRF et origines CORS selon la configuration du backend. Le code de vérification du portail est simulé, comme prévu pour la démonstration du projet.
