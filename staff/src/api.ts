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
  telephones: { numero_telephone: string }[]; historiques_medicaux_recus?: SharedPatientHistory[]
}

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
    const body = await response.json().catch(() => null) as { detail?: string } | null
    throw new Error(body?.detail || `Erreur API (${response.status})`)
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
    infirmier: ['dashboard', 'appointments', 'patients', 'consultations', 'admissions', 'laboratory'],
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
