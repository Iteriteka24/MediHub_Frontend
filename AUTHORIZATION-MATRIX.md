# Authentification et accès MediHub

## Règle d’autorisation

La session du personnel vient de l’API Django. Le frontend masque les modules et les actions selon le rôle et l’établissement ; le backend reste l’autorité et vérifie chaque requête. Une page autorisée peut donc contenir des actions réservées à certains rôles.

## Personnel hospitalier

| Rôle | Modules visibles | Limites principales appliquées par l’API |
| --- | --- | --- |
| Administrateur | Tableau de bord, rendez-vous, patients, consultations, hospitalisation, laboratoire, facturation, personnel | Consultations en lecture seule ; peut gérer les chambres, les lits, le catalogue des examens, les hospitalisations et la facturation. La pharmacie est un établissement distinct. |
| Médecin | Tableau de bord, rendez-vous, patients, consultations, hospitalisation, laboratoire | Peut rédiger et clôturer ses consultations, prescrire des examens et décider une hospitalisation. |
| Infirmier | Tableau de bord, rendez-vous, patients, consultations, hospitalisation | Consultations en lecture seule ; peut affecter les lits et enregistrer une sortie, mais ne crée pas une hospitalisation. |
| Secrétaire | Tableau de bord, rendez-vous, patients | Pas d’accès aux consultations, à l’hospitalisation, au laboratoire, à la facturation ou au personnel. |
| Comptable | Tableau de bord, facturation | Pas d’accès aux modules cliniques. |
| Technicien de laboratoire | Tableau de bord, laboratoire | Peut enregistrer des résultats ; la prescription reste réservée au médecin. |

## Personnel de pharmacie

| Rôle | Modules visibles | Limites principales appliquées par l’API |
| --- | --- | --- |
| Administrateur de pharmacie | Tableau de bord, pharmacie, personnel | Gestion du catalogue et des stocks de sa pharmacie ; pas d’accès aux modules hospitaliers. |
| Pharmacien | Tableau de bord, pharmacie | Gestion du stock et délivrance selon les règles de prescription ; pas d’accès aux modules hospitaliers. |

## Notes de périmètre

- Le rôle seul ne suffit pas : les opérations sont aussi limitées au type et à l’identifiant de l’établissement autorisé.
- L’administrateur hospitalier peut lire les consultations, mais ne peut ni en rédiger ni en clôturer. Les dossiers restent des données médicales sensibles ; si la politique de l’établissement doit interdire même cette lecture, il faudra modifier aussi les permissions du backend.
- L’ajout de médicaments est réservé aux comptes de pharmacie par l’API. Le catalogue hospitalier reste consultable par le médecin et l’administrateur, mais le formulaire d’ajout n’est pas proposé à l’administrateur hospitalier.
- Les règles de menu du frontend sont une aide d’affichage. Elles ne remplacent jamais les contrôles de permission du backend.
