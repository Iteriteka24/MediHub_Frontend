export type StaffRole = 'Administrateur' | 'Médecin' | 'Infirmier' | 'Pharmacien hospitalier' | 'Pharmacien partenaire' | 'Agent d’accueil'
export type StaffPermission = 'dashboard' | 'appointments' | 'patients' | 'consultations' | 'admissions' | 'laboratory' | 'pharmacy' | 'billing' | 'staff'
export type FacilityType = 'hospital' | 'hospital-pharmacy' | 'independent-pharmacy'

export type AuthSession = {
  user: { id: string; name: string; email: string; role: StaffRole }
  facility: { id: string; name: string; type: FacilityType; linkedHospitalIds: string[] }
  permissions: StaffPermission[]
  demo: true
}

export const demoPassword = 'demo2026'

export const demoUsers: AuthSession[] = [
  { user: { id: 'staff-admin', name: 'Dr. Aline Manirakiza', email: 'admin@hopitalkira.bi', role: 'Administrateur' }, facility: { id: 'hospital-kira', name: 'Hôpital Kira', type: 'hospital', linkedHospitalIds: ['hospital-kira'] }, permissions: ['dashboard', 'appointments', 'patients', 'consultations', 'admissions', 'laboratory', 'pharmacy', 'billing', 'staff'], demo: true },
  { user: { id: 'staff-doctor', name: 'Dr. Jean Nkurunziza', email: 'medecin@hopitalkira.bi', role: 'Médecin' }, facility: { id: 'hospital-kira', name: 'Hôpital Kira', type: 'hospital', linkedHospitalIds: ['hospital-kira'] }, permissions: ['dashboard', 'appointments', 'patients', 'consultations', 'laboratory'], demo: true },
  { user: { id: 'staff-nurse', name: 'Infirmière Chantal Mbazumutima', email: 'infirmier@hopitalkira.bi', role: 'Infirmier' }, facility: { id: 'hospital-kira', name: 'Hôpital Kira', type: 'hospital', linkedHospitalIds: ['hospital-kira'] }, permissions: ['dashboard', 'appointments', 'patients', 'consultations', 'admissions', 'laboratory'], demo: true },
  { user: { id: 'staff-pharmacist', name: 'Pharm. A. Ndayisenga', email: 'pharmacie@hopitalkira.bi', role: 'Pharmacien hospitalier' }, facility: { id: 'hospital-kira', name: 'Pharmacie · Hôpital Kira', type: 'hospital-pharmacy', linkedHospitalIds: ['hospital-kira'] }, permissions: ['dashboard', 'pharmacy'], demo: true },
  { user: { id: 'staff-partner-pharmacist', name: 'Pharm. S. Minani', email: 'contact@pharmacie-rohero.bi', role: 'Pharmacien partenaire' }, facility: { id: 'pharmacy-rohero', name: 'Pharmacie Centrale Rohero', type: 'independent-pharmacy', linkedHospitalIds: [] }, permissions: ['dashboard', 'pharmacy'], demo: true },
  { user: { id: 'staff-reception', name: 'Nadia Irakoze', email: 'accueil@hopitalkira.bi', role: 'Agent d’accueil' }, facility: { id: 'hospital-kira', name: 'Hôpital Kira', type: 'hospital', linkedHospitalIds: ['hospital-kira'] }, permissions: ['dashboard', 'appointments'], demo: true },
]

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
  if (role === 'Pharmacien hospitalier' || role === 'Pharmacien partenaire') return 'Pharmacie'
  if (role === 'Agent d’accueil') return 'Rendez-vous'
  return 'Vue d’ensemble'
}
