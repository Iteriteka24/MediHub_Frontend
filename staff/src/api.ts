import type { AuthSession, StaffPermission } from './auth'

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '')

export type BackendStaff = {
  matricule_personnel: string
  identifiant_connexion: string
  nom: string
  prenom: string
  role_metier: string
  role_acces: string
  id_etablissement: string
  type_etablissement: 'hopital' | 'pharmacie'
}

export type StaffMember = Omit<BackendStaff, 'id_etablissement' | 'type_etablissement'> & {
  email_professionnel: string
  date_embauche: string
  role_acces: string
  actif: boolean
  specialite_medecin?: string | null
}

export type StaffMemberInput = {
  nom: string
  prenom: string
  email_professionnel: string
  role_metier: string
  date_embauche: string
  identifiant_connexion: string
  role_acces: string
  password: string
  specialite?: string
}

export type ApiSessionResponse = { authenticated: boolean; user?: BackendStaff }
export type SharedPatientHistory = {
  id_historique_partage: string
  date_consentement: string
  hopital_source: string
  resume_medical: { allergies?: string | null; antecedents_medicaux?: string | null; groupe_sanguin?: string | null; mesures_poids?: { poids_kg: string | number; date_mesure: string }[] }
  documents: { id_document_partage: string; type_document: string; titre: string; date_document: string | null }[]
}
export type BackendPatient = {
  id_patient: string; nom_patient: string; prenom_patient: string; date_naissance: string; sexe: string
  adresse?: string; allergies?: string; antecedents_medicaux?: string; groupe_sanguin?: string
  telephones: { numero_telephone: string }[]; historiques_medicaux_recus?: SharedPatientHistory[]
}

export type BackendDoctor = { matricule_personnel: string; nom: string; prenom: string; specialite: string }
export type BackendAppointment = {
  id_rdv: string; date_rendez_vous: string; heure_rendez_vous: string; statut_rendez_vous: string
  id_patient: string; matricule_personnel: string; motif: string
  patient: { nom: string; prenom: string }; medecin: { nom: string; prenom: string; specialite: string }
}

export type BackendConsultation = {
  id_acte: string
  acte: { id_acte: string; date_acte: string; libelle_acte: string; montant_base: string | number; id_patient: string }
  diagnostic: string
  observations: string | null
  id_rendez_vous: string | null
  matricule_personnel: string
  statut_episode: 'en_cours' | 'clos'
  date_cloture_episode: string | null
}
export type BackendHospitalisation = { id_acte: string; id_patient: string; date_entree: string; date_sortie: string | null; id_acte_consultation: string; id_chambre: string | null; id_lit: string | null }
export type BackendRoom = { id_chambre: string; numero_chambre: string; type_chambre: string | null; code_service: string }
export type BackendBed = { id_lit: string; numero_lit: string; id_chambre: string }
export type BackendService = { code_service: string; nom_service: string }
export type BackendExam = { id_examen: string; code_examen: string; libelle_examen: string; tarif: string | number }
export type BackendPrescribedExam = { id_acte: string; id_patient: string; id_acte_consultation: string; id_examen: string; code_examen: string; libelle_examen: string; date_prescription_examen: string; date_realisation: string | null; resultat: { contenu_resultat: string | null; date_disponibilite: string | null } | null }
export type BackendMedicine = { id_medicament: string; code_medicament: string; nom_medicament: string; dosage: string; forme: string; prix_catalogue: string | number; seuil_alerte: number; vente_libre: boolean; quantite_stock: number }
export type BackendLot = { id_lot: string; numero_lot: string; date_peremption: string; quantite_stock: number; id_medicament: string }
export type BackendSale = { id_vente: string; date_vente: string; id_patient: string | null; id_client: string | null; id_prescription: string | null; lignes: { id_medicament: string; nom_medicament: string; quantite_demandee: number; quantite_delivree: number; prix_facture: string | number }[] }
export type BackendInvoice = { id_facture: string; date_emission: string; id_patient: string; patient?: { nom: string; prenom: string }; id_acte_consultation: string; statut_facture: string; montant_total: string | number; montant_patient: string | number; solde_patient: string | number; lignes: { designation: string; quantite: string | number; prix_unitaire: string | number; montant_ligne: string | number }[] }
export type BackendBillableEpisode = { id_acte: string; id_patient: string; nom_patient: string; prenom_patient: string; date_acte: string; libelle_acte: string }
export type BackendHospitalPrescription = { id_prescription: string; id_patient: string; date_prescription: string; lignes: { code_medicament: string; nom_medicament: string; dosage: string; posologie: string; quantite_prescrite: number; duree_traitement: number; disponible_dans_cette_pharmacie: boolean }[] }
export type BackendMedicationPrescription = { id_prescription: string; date_prescription: string; id_patient: string; id_acte_consultation: string; lignes: { id_medicament: string; code_medicament: string; nom_medicament: string; posologie: string; quantite_prescrite: number; duree_traitement: number }[] }

function csrfToken() {
  return document.cookie.split('; ').find(cookie => cookie.startsWith('csrftoken='))?.slice('csrftoken='.length) || ''
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method || 'GET').toUpperCase()
  const headers = new Headers(options.headers)
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    if (!csrfToken()) await fetch(`${API_BASE}/api/auth/session/`, { credentials: 'include' })
    const token = csrfToken()
    if (token) headers.set('X-CSRFToken', decodeURIComponent(token))
  }
  const response = await fetch(`${API_BASE}${path}`, { ...options, method, headers, credentials: 'include' })
  if (!response.ok) {
    const body = await response.json().catch(() => null) as Record<string, unknown> | null
    const detail = typeof body?.detail === 'string'
      ? body.detail
      : body
        ? Object.entries(body).map(([field, value]) => `${field} : ${Array.isArray(value) ? value.join(', ') : String(value)}`).join(' · ')
        : ''
    throw new Error(detail || `Erreur API (${response.status})`)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export function staffSessionFromBackend(user: BackendStaff): AuthSession {
  const name = `${user.prenom} ${user.nom}`.trim()
  const roleNames: Record<string, string> = {
    administrateur: 'Administrateur', medecin: 'Médecin', infirmier: 'Infirmier',
    secretaire: 'Agent d’accueil', pharmacien: 'Pharmacien', comptable: 'Comptable',
    technicien_labo: 'Technicien de laboratoire',
  }
  const role = roleNames[user.role_metier] || user.role_metier
  const featureMap: Record<string, StaffPermission[]> = {
    administrateur: ['dashboard', 'appointments', 'patients', 'consultations', 'admissions', 'laboratory', 'pharmacy', 'billing', 'staff'],
    medecin: ['dashboard', 'appointments', 'patients', 'consultations', 'admissions', 'laboratory'],
    infirmier: ['dashboard', 'appointments', 'patients', 'consultations', 'admissions'],
    secretaire: ['dashboard', 'appointments', 'patients'],
    pharmacien: ['dashboard', 'pharmacy'],
    comptable: ['dashboard', 'billing'],
    technicien_labo: ['dashboard', 'laboratory'],
  }
  return {
    user: { id: user.matricule_personnel, name, email: user.identifiant_connexion, role },
    facility: {
      id: user.id_etablissement,
      name: 'Établissement MediHub',
      type: user.type_etablissement === 'pharmacie' ? 'independent-pharmacy' : 'hospital',
      linkedHospitalIds: [],
    },
    permissions: featureMap[user.role_metier] || [],
    demo: false,
  }
}

export async function getStaffSession() {
  const result = await apiRequest<ApiSessionResponse>('/api/auth/session/')
  return result.authenticated && result.user ? enrichFacility(staffSessionFromBackend(result.user)) : null
}

export async function loginStaff(identifiant_connexion: string, password: string) {
  const result = await apiRequest<ApiSessionResponse>('/api/auth/session/', {
    method: 'POST', body: JSON.stringify({ identifiant_connexion, password }),
  })
  if (!result.authenticated || !result.user) throw new Error('Réponse de connexion incomplète.')
  return enrichFacility(staffSessionFromBackend(result.user))
}

async function enrichFacility(session: ReturnType<typeof staffSessionFromBackend>) {
  type Establishment = { id_etablissement: string; nom_etablissement: string; type_etablissement: 'hopital' | 'pharmacie'; id_etablissement_hopital_rattachement?: string | null }
  try {
    const response = await apiRequest<Establishment[] | { results: Establishment[] }>('/api/etablissements/')
    const establishments = Array.isArray(response) ? response : response.results
    const current = establishments.find(item => item.id_etablissement === session.facility.id)
    if (current) {
      session.facility.name = current.nom_etablissement
      if (current.type_etablissement === 'pharmacie') {
        session.facility.type = current.id_etablissement_hopital_rattachement ? 'hospital-pharmacy' : 'independent-pharmacy'
        session.facility.linkedHospitalIds = current.id_etablissement_hopital_rattachement ? [current.id_etablissement_hopital_rattachement] : []
      }
    }
  } catch {
    session.facility.name = 'Établissement MediHub'
  }
  return session
}

export async function logoutStaff() {
  await apiRequest<void>('/api/auth/session/', { method: 'DELETE' })
}

export function getStaffPatients() {
  return apiRequest<BackendPatient[] | { results: BackendPatient[] }>('/api/patients/')
}
export const createStaffPatient = (data: { nom_patient: string; prenom_patient: string; date_naissance: string; sexe: 'F' | 'M'; adresse?: string; numero_piece_identite?: string; allergies?: string; antecedents_medicaux?: string; groupe_sanguin?: string }) => apiRequest<BackendPatient>('/api/patients/', { method: 'POST', body: JSON.stringify(data) })
export const addStaffPatientTelephone = (data: { id_patient: string; numero_telephone: string; type_telephone: string }) => apiRequest('/api/patients/telephones/', { method: 'POST', body: JSON.stringify(data) })

export function getStaffMembers() {
  return apiRequest<StaffMember[] | { results: StaffMember[] }>('/api/etablissements/personnel/')
}

export function getStaffDoctors() {
  return apiRequest<BackendDoctor[] | { results: BackendDoctor[] }>('/api/etablissements/medecins/')
}

export function getStaffAppointments() {
  return apiRequest<BackendAppointment[] | { results: BackendAppointment[] }>('/api/soins/rendez-vous/')
}

export function createStaffAppointment(data: { id_patient: string; matricule_personnel: string; date_rendez_vous: string; heure_rendez_vous: string; motif: string }) {
  return apiRequest<BackendAppointment>('/api/soins/rendez-vous/', { method: 'POST', body: JSON.stringify(data) })
}

export const getStaffConsultations = () => apiRequest<BackendConsultation[]>('/api/soins/consultations/')
export const createStaffConsultation = (data: { id_patient: string; date_acte: string; libelle_acte: string; montant_base: number; diagnostic: string; observations?: string; id_rendez_vous?: string }) => apiRequest<BackendConsultation>('/api/soins/consultations/', { method: 'POST', body: JSON.stringify(data) })
export const closeStaffConsultation = (id: string) => apiRequest<BackendConsultation>(`/api/soins/consultations/${id}/clore/`, { method: 'POST', body: JSON.stringify({}) })
export const getStaffHospitalisations = () => apiRequest<BackendHospitalisation[]>('/api/soins/hospitalisations/')
export const getStaffRooms = () => apiRequest<BackendRoom[]>('/api/soins/chambres/')
export const getStaffBeds = () => apiRequest<BackendBed[]>('/api/soins/lits/')
export const getStaffServices = () => apiRequest<BackendService[]>('/api/etablissements/services/')
export const createStaffHospitalisation = (data: { id_acte_consultation: string; date_entree: string; date_acte: string; libelle_acte: string; montant_base: number; id_chambre?: string | null; id_lit?: string | null }) => apiRequest<BackendHospitalisation>('/api/soins/hospitalisations/', { method: 'POST', body: JSON.stringify(data) })
export const dischargeStaffHospitalisation = (id: string, date_sortie: string) => apiRequest<BackendHospitalisation>(`/api/soins/hospitalisations/${id}/sortie/`, { method: 'POST', body: JSON.stringify({ date_sortie }) })
export const getStaffExams = () => apiRequest<BackendExam[]>('/api/laboratoire/examens/')
export const createStaffExam = (data: { code_examen: string; libelle_examen: string; tarif: number }) => apiRequest<BackendExam>('/api/laboratoire/examens/', { method: 'POST', body: JSON.stringify(data) })
export const getStaffPrescribedExams = () => apiRequest<BackendPrescribedExam[]>('/api/laboratoire/examens-prescrits/')
export const prescribeStaffExams = (data: { id_acte_consultation: string; codes_examens: string[] }) => apiRequest<{ examens_prescrits: BackendPrescribedExam[]; examens_non_disponibles: string[]; message_non_disponibles?: string | null }>('/api/laboratoire/prescrire/', { method: 'POST', body: JSON.stringify(data) })
export const saveStaffExamResult = (id: string, contenu_resultat: string) => apiRequest<{ id_resultat: string; contenu_resultat: string; date_disponibilite: string }>(`/api/laboratoire/examens-prescrits/${id}/resultat/`, { method: 'POST', body: JSON.stringify({ contenu_resultat }) })
export const getStaffMedicines = () => apiRequest<BackendMedicine[]>('/api/pharmacie/medicaments/')
export const getStaffLots = () => apiRequest<BackendLot[]>('/api/pharmacie/lots/')
export const createStaffMedicine = (data: { code_medicament: string; nom_medicament: string; dosage: string; forme: string; prix_catalogue: number; seuil_alerte: number; vente_libre: boolean }) => apiRequest<BackendMedicine>('/api/pharmacie/medicaments/', { method: 'POST', body: JSON.stringify(data) })
export const createStaffLot = (data: { numero_lot: string; date_peremption: string; quantite_stock: number; id_medicament: string }) => apiRequest<BackendLot>('/api/pharmacie/lots/', { method: 'POST', body: JSON.stringify(data) })
export const getStaffSales = () => apiRequest<BackendSale[]>('/api/pharmacie/ventes/')
export const createStaffSale = (data: { lignes: { id_medicament: string; quantite: number }[]; client?: { nom: string; prenom?: string }; id_patient?: string; id_prescription?: string; nom_prescripteur_externe?: string; date_prescription_externe?: string; statut_paiement?: 'paye' | 'impaye' | 'partiel'; moyen_paiement?: 'especes' | 'mobile_money' | 'carte' }) => apiRequest<BackendSale>('/api/pharmacie/ventes/', { method: 'POST', body: JSON.stringify(data) })
export const getStaffInvoices = () => apiRequest<BackendInvoice[]>('/api/facturation/factures/')
export const getStaffBillableEpisodes = () => apiRequest<BackendBillableEpisode[]>('/api/facturation/factures/episodes-a-facturer/')
export const generateStaffInvoice = (id_acte_consultation: string) => apiRequest<BackendInvoice>('/api/facturation/factures/generer/', { method: 'POST', body: JSON.stringify({ id_acte_consultation }) })
export const registerStaffPayment = (id: string, data: { montant_paye: number; moyen_paiement: 'especes' | 'mobile_money' | 'carte' }) => apiRequest(`/api/facturation/factures/${id}/paiements/`, { method: 'POST', body: JSON.stringify(data) })
export const getStaffHospitalPrescription = (id: string) => apiRequest<BackendHospitalPrescription>(`/api/pharmacie/prescriptions/${id}/`)
export const getStaffMedicationPrescriptions = () => apiRequest<BackendMedicationPrescription[]>('/api/pharmacie/prescriptions/')
export const createStaffMedicationPrescription = (data: { id_patient: string; id_consultation: string; lignes: { id_medicament: string; posologie: string; quantite_prescrite: number; duree_traitement: number }[] }) => apiRequest<BackendMedicationPrescription>('/api/pharmacie/prescriptions/', { method: 'POST', body: JSON.stringify(data) })

export function createStaffMember(data: StaffMemberInput) {
  return apiRequest<StaffMember>('/api/etablissements/personnel/', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export type DashboardStatistics = {
  date_debut: string
  date_fin: string
  soins?: {
    rendez_vous: number
    rendez_vous_planifies: number
    rendez_vous_a_venir: number
    rendez_vous_annules: number
    consultations: number
    hospitalisations: number
    hospitalisations_en_cours: number
  }
  pharmacie?: {
    ventes: number
    chiffre_ventes: string | number
    medicaments_sous_seuil: number
    lots_proches_peremption: number
  }
  laboratoire?: {
    examens_prescrits: number
    examens_realises: number
    examens_en_attente: number
    resultats_disponibles: number
  }
  facturation?: {
    factures_emises: number
    montant_facture: string | number
    paiements_recus: string | number
    factures_soudees: number
  }
}

export function getDashboardStatistics() {
  return apiRequest<DashboardStatistics>('/api/statistiques/')
}
