# Authentification et accès MediHub

## Prototype frontend actuel

L’écran `/connexion` permet de choisir l’un des profils de démonstration. Le mot de passe local est `demo2026`. La session de démonstration est conservée dans le navigateur ; les enregistrements restent séparés par identifiant d’établissement.

Cette connexion sert uniquement à parcourir les interfaces selon un rôle. Elle ne protège aucune donnée : le navigateur contrôle ses propres données et permissions. Ne pas utiliser ces profils en production.

## Matrice rôle → modules

| Rôle | Tableau de bord | Rendez-vous | Dossiers patients | Consultations | Hospitalisation | Laboratoire | Pharmacie | Facturation | Personnel |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Administrateur établissement | Oui | Oui | Oui | Oui | Oui | Oui | Oui | Oui | Oui |
| Médecin | Oui | Oui | Oui | Oui | — | Oui | — | — | — |
| Infirmier | Oui | Oui | Oui | Oui | Oui | Oui | — | — | — |
| Pharmacien hospitalier | Oui | — | — | — | — | — | Oui, dans sa pharmacie hospitalière | — | — |
| Pharmacien partenaire indépendant | Oui | — | — | — | — | — | Oui, dans sa pharmacie uniquement | — | — |
| Agent d’accueil | Oui | Oui | — | — | — | — | — | — | — |

L’accès aux dossiers patients est réservé ici aux rôles cliniques, car l’écran de dossier contient des informations médicales. Une permission plus fine (par exemple identité seule pour l’accueil) pourra être ajoutée au backend et au frontend si le besoin est confirmé.

## Établissements et pharmacies

Un compte appartient à un établissement. Les types prévus dans le prototype sont hôpital, pharmacie hospitalière et pharmacie indépendante. La pharmacie Rohero de démonstration a une liste de `linkedHospitalIds` vide : elle ne reçoit pas automatiquement les patients, les rendez-vous ou les stocks de l’Hôpital Kira. Ses lots et délivrances sont enregistrés dans un espace local distinct.

Une relation pharmacie–hôpital devra être explicitement créée et gérée par le backend. Une pharmacie partenaire pourra recevoir une prescription référencée, mais le prototype ne vérifie pas encore son code et ne constitue pas une transmission réelle de dossier patient.

## Contrat à prévoir avec le backend

- Connexion : le serveur vérifie le compte et renvoie une session ou un jeton avec profil, permissions et établissement actif.
- Profil de session : identité, rôle, permissions effectives, établissement et relations autorisées.
- Contrôle serveur : chaque API vérifie la session, la permission sur l’action et le périmètre d’établissement ; masquer un bouton ne suffit pas.
- Pharmacie partenaire : contrôler explicitement la prescription, son établissement d’origine, les informations minimales nécessaires à la délivrance et le droit de la pharmacie destinataire.
- Fin de session : invalider la session côté serveur et retirer les données de session du navigateur.

Le frontend devra remplacer les profils de démonstration par les réponses de ces endpoints quand le backend sera disponible. Les listes d’autorisations présentes dans le code sont des aides d’affichage, jamais des règles de sécurité.
