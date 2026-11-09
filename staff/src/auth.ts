export type StaffRole = string
export type StaffPermission = 'dashboard' | 'appointments' | 'patients' | 'consultations' | 'admissions' | 'laboratory' | 'pharmacy' | 'billing' | 'staff'
export type FacilityType = 'hospital' | 'hospital-pharmacy' | 'independent-pharmacy'

export type AuthSession = {
  user: { id: string; name: string; email: string; role: StaffRole }
  facility: { id: string; name: string; type: FacilityType; linkedHospitalIds: string[] }
  permissions: StaffPermission[]
  demo: boolean
}

export function featureForPage(page: string): StaffPermission | undefined {
  const mapping: Record<string, StaffPermission> = {
    'Vue d’ensemble': 'dashboard', 'Rendez-vous': 'appointments', 'Patients': 'patients',
    'Consultations': 'consultations', 'Hospitalisation': 'admissions', 'Laboratoire': 'laboratory',
    'Pharmacie': 'pharmacy', 'Facturation': 'billing', 'Personnel': 'staff',
  }
  return mapping[page]
}

export function featureForRoute(path: string): StaffPermission | undefined {
  if (path.startsWith('/rendez-vous/')) return 'appointments'
  if (path.startsWith('/facturation/')) return 'billing'
  if (path.startsWith('/consultations/')) return 'consultations'
  if (path.startsWith('/hospitalisation/')) return 'admissions'
  if (path.startsWith('/laboratoire/')) return 'laboratory'
  if (path.startsWith('/pharmacie/')) return 'pharmacy'
}

export function homePageForRole(role: StaffRole): string {
  if (role === 'Médecin') return 'Consultations'
  if (role === 'Infirmier') return 'Hospitalisation'
  if (role === 'Pharmacien' || role === 'Pharmacien hospitalier' || role === 'Pharmacien partenaire') return 'Pharmacie'
  if (role === 'Agent d’accueil') return 'Rendez-vous'
  return 'Vue d’ensemble'
}
