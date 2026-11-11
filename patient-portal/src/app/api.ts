// In production the Next.js app proxies /api/* to Django on the server. This
// keeps patient session and CSRF cookies on the portal's own origin.
const API_BASE = process.env.NODE_ENV === 'production'
  ? ''
  : (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '')

export type Hospital = { id_etablissement: string; nom_etablissement: string; adresse: string }
export type AccountSession = {
  authenticated: boolean
  type_compte?: 'patient'
  compte_patient?: { id_compte_patient: string; identifiant_connexion: string; nom: string; prenom: string }
}
export type AccountCodeResponse = { detail: string; id_code: string; expire_dans_secondes: number; code_simule?: string }
export type Dossier = { id_hopital: string; nom_hopital: string; id_patient: string; nom: string; prenom: string }
export type Doctor = { matricule_personnel: string; nom: string; prenom: string; specialite: string; photo_profil?: string | null }
export type Appointment = {
  id_rdv: string; date_rendez_vous: string; heure_rendez_vous: string; statut_rendez_vous: string
  medecin: { matricule_personnel: string; nom: string; prenom: string; specialite: string }
}
export type BookedAppointment = { id_patient: string; dossier_cree: boolean; rendez_vous: Appointment }
export type DocumentType = 'resultat_examen' | 'prescription' | 'facture' | 'historique_partage'
export type PatientDocument = { type_document: DocumentType; id_document: string; titre: string; date: string | null; id_hopital_source?: string }
export type SharedHistory = {
  id_historique_partage: string; id_etablissement_source: string; date_consentement: string
  resume_medical: { nom?: string; prenom?: string; date_naissance?: string; allergies?: string | null; antecedents_medicaux?: string | null; groupe_sanguin?: string | null; hopital_source?: string; mesures_poids?: { poids_kg: string | number; date_mesure: string }[] }
  documents: { id_document_partage: string; type_document: string; titre: string; date_document: string | null }[]
}
export type PatientProfile = {
  id_patient: string; nom: string; prenom: string; allergies: string | null; antecedents_medicaux: string | null
  groupe_sanguin: string | null; medecin_referent: { nom: string; prenom: string; specialite: string; photo_profil?: string | null } | null
  mesures_poids: { poids_kg: number; date_mesure: string }[]; historiques_partages: SharedHistory[]
}
export type PatientAppointmentRequest = { matricule_personnel: string; date_rendez_vous: string; heure_rendez_vous: string }
export type SignupPayload = {
  identifiant_connexion: string; nom: string; prenom: string; date_naissance: string; sexe: string
  numero_telephone: string; password: string; allergies_declarees?: string; antecedents_declares?: string; groupe_sanguin_declare?: string
}
export type HistoryShareRequest = {
  id_hopital_source: string; id_hopital_destination: string; consentement: true
  documents?: { type_document: Exclude<DocumentType, 'historique_partage'>; id_document: string }[]
}

function csrfToken() {
  if (typeof document === 'undefined') return ''
  return document.cookie.split('; ').find(cookie => cookie.startsWith('csrftoken='))?.slice('csrftoken='.length) || ''
}

function errorMessage(body: unknown, status: number) {
  if (body && typeof body === 'object') {
    const values = Object.values(body as Record<string, unknown>)
    const visit = (value: unknown): string | undefined => {
      if (typeof value === 'string') return value
      if (Array.isArray(value)) return value.map(visit).find(Boolean)
      if (value && typeof value === 'object') return Object.values(value as Record<string, unknown>).map(visit).find(Boolean)
      return undefined
    }
    const message = values.map(visit).find(Boolean)
    if (message) return message
  }
  return `Erreur API (${status})`
}

export async function patientApi<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method || 'GET').toUpperCase()
  const headers = new Headers(options.headers)
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    if (!csrfToken()) await fetch(`${API_BASE}/api/portail/session/`, { credentials: 'include' })
    const token = csrfToken()
    if (token) headers.set('X-CSRFToken', decodeURIComponent(token))
  }
  const response = await fetch(`${API_BASE}${path}`, { ...options, method, headers, credentials: 'include' })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(errorMessage(body, response.status))
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export const patientAccountSignup = (payload: SignupPayload) =>
  patientApi<AccountCodeResponse>('/api/portail/compte/inscription/', { method: 'POST', body: JSON.stringify(payload) })
export const patientAccountLogin = (identifiant_connexion: string, password: string) =>
  patientApi<AccountCodeResponse>('/api/portail/compte/connexion/', { method: 'POST', body: JSON.stringify({ identifiant_connexion, password }) })
export const verifyPatientAccountCode = (id_code: string, code: string) =>
  patientApi<AccountSession>('/api/portail/compte/codes/verifier/', { method: 'POST', body: JSON.stringify({ id_code, code }) })
export const getPatientDossiers = () => patientApi<Dossier[]>('/api/portail/compte/dossiers/')
export const getHospitals = () => patientApi<Hospital[]>('/api/portail/hopitaux/')
export const getHospitalDoctors = (hospitalId: string) => {
  const query = new URLSearchParams({ id_hopital: hospitalId })
  return patientApi<Doctor[]>(`/api/portail/medecins/?${query}`)
}
export const checkHospitalAppointmentAvailability = (hospitalId: string, request: PatientAppointmentRequest) => {
  const query = new URLSearchParams({ id_hopital: hospitalId, ...request })
  return patientApi<{ disponible: boolean; raison?: string }>(`/api/portail/compte/disponibilite/?${query}`)
}
export const bookHospitalAppointment = (hospitalId: string, request: PatientAppointmentRequest) =>
  patientApi<BookedAppointment>(`/api/portail/compte/rendez-vous/${hospitalId}/`, { method: 'POST', body: JSON.stringify(request) })
export const sharePatientHistory = (request: HistoryShareRequest) =>
  patientApi<{ id_historique_partage: string; date_consentement: string; id_hopital_destination: string; nombre_documents: number }>(
    '/api/portail/compte/partages/historique/', { method: 'POST', body: JSON.stringify(request) })
export const getPatientProfile = (hospitalId: string) =>
  patientApi<PatientProfile>(`/api/portail/profil/?${new URLSearchParams({ id_hopital: hospitalId })}`)
export const getPatientDocuments = (hospitalId: string) =>
  patientApi<PatientDocument[]>(`/api/portail/documents/?${new URLSearchParams({ id_hopital: hospitalId })}`)

export async function patientDocument(item: PatientDocument, hospitalId: string, download = false) {
  const suffix = download ? 'telecharger/' : ''
  const query = new URLSearchParams({ id_hopital: hospitalId })
  const response = await fetch(`${API_BASE}/api/portail/documents/${item.type_document}/${item.id_document}/${suffix}?${query}`, { credentials: 'include' })
  if (!response.ok) throw new Error(`Impossible d’ouvrir ce document (${response.status}).`)
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  if (download) {
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `medihub-${item.type_document}-${item.id_document}.pdf`
    anchor.click()
    URL.revokeObjectURL(url)
  } else {
    window.open(url, '_blank', 'noopener,noreferrer')
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }
}

export const patientApiBase = API_BASE
