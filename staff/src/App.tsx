import { useEffect, useMemo, useState, type FormEvent } from 'react'
import './App.css'
import './reference-overrides.css'
import './personnel.css'
import { AppointmentPage, type AppointmentRecord } from './ActionPages'
import { AuthPage } from './AuthPage'
import { addStaffPatientTelephone, createStaffAppointment, createStaffPatient, getStaffAppointments, getStaffDoctors, getStaffPatients, getStaffSession, logoutStaff, type BackendAppointment, type BackendDoctor, type SharedPatientHistory } from './api'
import { Dashboard as StaffDashboard } from './Dashboard'
import { PersonnelPage } from './PersonnelPage'
import { AdmissionsModule, BillingModule, ConsultationsModule, LaboratoryModule, PharmacyModule } from './PersistedModules'
import { featureForPage, featureForRoute, homePageForRole, type AuthSession, type StaffPermission } from './auth'

type Patient = { initials: string; name: string; id: string; age: number; sex: string; phone: string; color: string; adresse?: string; allergies?: string; antecedents?: string; groupeSanguin?: string; sharedHistories?: SharedPatientHistory[] }

function mapAppointment(item: BackendAppointment): AppointmentRecord {
  return { id: item.id_rdv, patient: `${item.patient.prenom} ${item.patient.nom}`.trim(), doctor: `${item.medecin.prenom} ${item.medecin.nom}${item.medecin.specialite ? ` · ${item.medecin.specialite}` : ''}`.trim(), date: item.date_rendez_vous, time: item.heure_rendez_vous.slice(0, 5), reason: item.motif || '' }
}

const nav = [
  { group: 'PRINCIPAL', items: [['Vue d’ensemble', '◫'], ['Rendez-vous', '▦'], ['Patients', '♙']] },
  { group: 'ACTIVITÉS MÉDICALES', items: [['Consultations', '✚'], ['Hospitalisation', '▤'], ['Laboratoire', '◉']] },
  { group: 'GESTION', items: [['Pharmacie', '⌁'], ['Facturation', '▧'], ['Personnel', '♧']] },
]

function App() {
  const [session, setSession] = useState<AuthSession | null>(null)
  const [checkingSession, setCheckingSession] = useState(true)
  const [page, setPage] = useState(() => session ? homePageForRole(session.user.role) : 'Vue d’ensemble')
  const [route, setRoute] = useState(() => window.location.pathname)
  const [query, setQuery] = useState('')
  const [patients, setPatients] = useState<Patient[]>([])
  const [notice, setNotice] = useState('')
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([])
  const [doctors, setDoctors] = useState<BackendDoctor[]>([])
  const [dashboardRefreshKey, setDashboardRefreshKey] = useState(0)
  const [patientRefreshKey, setPatientRefreshKey] = useState(0)
  const filtered = useMemo(() => patients.filter((p) => `${p.name} ${p.id} ${p.phone}`.toLowerCase().includes(query.toLowerCase())), [patients, query])

  useEffect(() => {
    const syncRoute = () => setRoute(window.location.pathname)
    window.addEventListener('popstate', syncRoute)
    return () => window.removeEventListener('popstate', syncRoute)
  }, [])

  useEffect(() => {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('medihub:')) localStorage.removeItem(key)
    }
  }, [])

  useEffect(() => {
    let active = true
    getStaffSession().then(next => {
      if (active && next) {
        setSession(next)
        setPage(homePageForRole(next.user.role))
      }
    }).catch(() => {
      if (active) setNotice('Le serveur MediHub est indisponible. Vérifiez qu’il fonctionne sur http://localhost:8000.')
    }).finally(() => { if (active) setCheckingSession(false) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    setPatients([])
    setAppointments([])
  }, [session?.facility.id])

  useEffect(() => {
    if (!session || !session.permissions.includes('patients') || session.facility.type !== 'hospital') return
    let active = true
    getStaffPatients().then(response => {
      if (!active) return
      const records = Array.isArray(response) ? response : response.results
      const mapped: Patient[] = records.map((record, index) => {
        const name = `${record.prenom_patient} ${record.nom_patient}`.trim()
        const birth = new Date(`${record.date_naissance}T00:00:00`)
        const now = new Date()
        const age = Number.isNaN(birth.getTime()) ? 0 : now.getFullYear() - birth.getFullYear() - (now < new Date(now.getFullYear(), birth.getMonth(), birth.getDate()) ? 1 : 0)
        const initials = name.split(/\s+/).slice(0, 2).map(part => part[0] || '').join('').toUpperCase()
        return { initials, name, id: record.id_patient, age, sex: record.sexe === 'F' ? 'Femme' : record.sexe === 'M' ? 'Homme' : record.sexe, phone: record.telephones?.[0]?.numero_telephone || 'Non renseigne', color: ['teal', 'blue', 'green', 'amber', 'purple'][index % 5], adresse: record.adresse, allergies: record.allergies, antecedents: record.antecedents_medicaux, groupeSanguin: record.groupe_sanguin, sharedHistories: record.historiques_medicaux_recus || [] }
      })
      setPatients(mapped)
    }).catch(error => {
      if (active) setNotice(error instanceof Error ? `Impossible de charger les dossiers patients : ${error.message}` : 'Impossible de charger les dossiers patients.')
    })
    return () => { active = false }
  }, [session?.facility.id, session?.permissions.join(','), session?.facility.type, patientRefreshKey])

  useEffect(() => {
    if (!session || !session.permissions.includes('appointments') || session.facility.type !== 'hospital') return
    let active = true
    Promise.all([getStaffDoctors(), getStaffAppointments()]).then(([doctorResponse, appointmentResponse]) => {
      if (!active) return
      setDoctors(Array.isArray(doctorResponse) ? doctorResponse : doctorResponse.results)
      setAppointments((Array.isArray(appointmentResponse) ? appointmentResponse : appointmentResponse.results).map(mapAppointment))
    }).catch(error => {
      if (active) setNotice(error instanceof Error ? `Impossible de charger l’agenda MediHub : ${error.message}` : 'Impossible de charger l’agenda MediHub.')
    })
    return () => { active = false }
  }, [session?.facility.id, session?.permissions.join(','), session?.facility.type])

  useEffect(() => {
    if (!session && window.location.pathname !== '/connexion') {
      window.history.replaceState({}, '', '/connexion')
      setRoute('/connexion')
    }
  }, [session])

  function navigate(path: string) {
    window.history.pushState({}, '', path)
    setRoute(path)
  }

  async function saveAppointment(record: AppointmentRecord & { patientId: string; doctorId: string }) {
    const response = await createStaffAppointment({ id_patient: record.patientId, matricule_personnel: record.doctorId, date_rendez_vous: record.date, heure_rendez_vous: record.time, motif: record.reason })
    const created = mapAppointment(response)
    setAppointments(current => [created, ...current.filter(item => item.id !== created.id)])
    setDashboardRefreshKey(value => value + 1)
    setNotice('Rendez-vous enregistre dans MediHub ; agenda et tableau de bord actualises.')
    try {
      const appointmentResponse = await getStaffAppointments()
      setAppointments((Array.isArray(appointmentResponse) ? appointmentResponse : appointmentResponse.results).map(mapAppointment))
    } catch {
      // La reponse de creation confirme que l'enregistrement est deja en base.
    }
    return created
  }

  const routeFeature = featureForRoute(route)
  const pageFeature = featureForPage(page)
  const allowed = (permission?: StaffPermission) => !permission || !!session?.permissions.includes(permission)
  const activeNav = nav.map(section => ({ ...section, items: section.items.filter(([label]) => allowed(featureForPage(label))) })).filter(section => section.items.length)

  async function logout() {
    try {
      await logoutStaff()
      setSession(null)
      setRoute('/connexion')
      window.history.replaceState({}, '', '/connexion')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'La déconnexion a échoué.')
    }
  }

  if (checkingSession) return <main className="auth-screen"><div className="auth-card"><div className="auth-brand"><span>✚</span><div><b>MediHub</b><small>ESPACE DU PERSONNEL</small></div></div><p>Vérification de votre session…</p></div></main>
  if (!session) return <AuthPage onLogin={profile => { setSession(profile); setPage(homePageForRole(profile.user.role)); window.history.replaceState({}, '', '/'); setRoute('/') }} />

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">✚</span><div><b>MediHub</b><small>ESPACE PROFESSIONNEL</small></div></div>
      <div className="facility"><span className="facility-icon">✚</span><div><b>{session.facility.name}</b><small>{session.facility.type === 'independent-pharmacy' ? 'Établissement indépendant' : 'Gitega, Burundi'}</small></div><span className="chevron">⌄</span></div>
      <nav>{activeNav.map((section) => <div className="nav-group" key={section.group}><p>{section.group}</p>{section.items.map(([label, icon]) => <button key={label} className={`nav-item ${page === label ? 'active' : ''}`} onClick={() => { setPage(label); if (route !== '/') navigate('/') }}><span className="nav-icon">{icon}</span><span>{label}</span></button>)}</div>)}</nav>
      <div className="sidebar-bottom"><button className="nav-item" onClick={() => setNotice('Centre d’aide : support@medihub.bi')}><span className="nav-icon">?</span>Aide & support</button><div className="user-card"><div className="avatar avatar-teal">{session.user.name.split(/\s+/).map(part => part[0]).slice(0, 2).join('')}</div><div><b>{session.user.name}</b><small>{session.user.role}</small></div></div></div>
    </aside>
    <main className="main-area">
      <header className="topbar"><div className="crumb">▦ &nbsp;{session.facility.name} <span>›</span> <b>{session.user.role}</b></div><div className="top-actions"><label className="global-search"><span>⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} onFocus={() => allowed('patients') && setPage('Patients')} placeholder="Rechercher" /></label>{allowed('pharmacy') && session.facility.type === 'hospital' && <button className="tenant-toggle" onClick={() => setPage('Pharmacie')}>⇄ &nbsp;Pharmacie partenaire</button>}<div className="today">◷ <span>{new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}</span></div><button className="icon-button" aria-label="Notifications" onClick={() => setNotice('Vous êtes à jour. Aucune nouvelle notification.')}>♧<i /></button><button className="top-logout" type="button" onClick={logout}><span aria-hidden="true">↪</span> Déconnexion</button><div className="top-avatar" title={session.user.name}>{session.user.name.split(/\s+/).map(part => part[0]).slice(0, 2).join('')}</div></div></header>
      <div className="content">
        {notice && <div className="toast">✓ &nbsp;{notice}<button onClick={() => setNotice('')}>×</button></div>}
        {!allowed(routeFeature || pageFeature) ? <AccessDenied onReturn={() => { navigate('/'); setPage(homePageForRole(session.user.role)) }} /> : route === '/rendez-vous/nouveau' ? <AppointmentPage patients={patients.map(patient => ({ id: patient.id, name: patient.name }))} doctors={doctors.map(doctor => ({ id: doctor.matricule_personnel, name: `${doctor.prenom} ${doctor.nom}`.trim(), specialty: doctor.specialite }))} currentUserId={session.user.id} onBack={() => { navigate('/'); setPage('Rendez-vous') }} onSave={saveAppointment} />
          : page === 'Consultations' || route === '/consultations/nouvelle' ? <ConsultationsModule session={session} onChanged={() => setDashboardRefreshKey(value => value + 1)} />
          : page === 'Hospitalisation' || route === '/hospitalisation/nouvelle' ? <AdmissionsModule session={session} onChanged={() => setDashboardRefreshKey(value => value + 1)} />
          : page === 'Laboratoire' || route === '/laboratoire/prescrire' ? <LaboratoryModule session={session} onChanged={() => setDashboardRefreshKey(value => value + 1)} />
          : page === 'Facturation' || route === '/facturation/nouvelle' ? <BillingModule session={session} onChanged={() => setDashboardRefreshKey(value => value + 1)} />
          : page === 'Pharmacie' || route === '/pharmacie/delivrance' ? <PharmacyModule session={session} onChanged={() => setDashboardRefreshKey(value => value + 1)} />
          : page === 'Vue d’ensemble' ? session.user.role === 'Administrateur' ? <StaffDashboard key={dashboardRefreshKey} facilityName={session.facility.name} patients={patients} onNavigate={setPage} /> : <RoleDashboard session={session} onNavigate={setPage} />
          : page === 'Patients' ? <Patients patients={filtered} query={query} setQuery={setQuery} facilityName={session.facility.name} canEditMedicalData={session.user.role !== 'Agent d’accueil'} onCreated={message => { setPatientRefreshKey(value => value + 1); setDashboardRefreshKey(value => value + 1); if (message) setNotice(message) }} onStartConsultation={patient => { setPage('Consultations'); navigate(`/consultations/nouvelle?patient=${encodeURIComponent(patient.id)}`) }} />
          : page === 'Personnel' ? <PersonnelPage canManage={session.user.role === 'Administrateur'} onNotice={message => { setNotice(message); setDashboardRefreshKey(value => value + 1) }} />
          : <ModulePage page={page} appointments={appointments} onAdd={() => {
            const paths: Record<string, string> = { 'Rendez-vous': '/rendez-vous/nouveau', 'Facturation': '/facturation/nouvelle', 'Consultations': '/consultations/nouvelle', 'Hospitalisation': '/hospitalisation/nouvelle', 'Laboratoire': '/laboratoire/prescrire' }
            if (paths[page]) navigate(paths[page]); else setNotice(`Action ${page.toLowerCase()} prête pour la démonstration.`)
          }} />}
        <footer>© 2026 MediHub <span>•</span> Les activités affichées sont synchronisées avec les données de l’établissement.</footer>
      </div>
    </main>

  </div>
}

function Patients({ patients, query, setQuery, facilityName, canEditMedicalData, onCreated, onStartConsultation }: { patients: Patient[]; query: string; setQuery: (v: string) => void; facilityName: string; canEditMedicalData: boolean; onCreated: (notice?: string) => void; onStartConsultation: (patient: Patient) => void }) {
  const [selectedId, setSelectedId] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const selected = patients.find(patient => patient.id === selectedId) || patients[0]

  function exportCsv() {
    const quote = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`
    const rows = [['Numero dossier', 'Nom complet', 'Age', 'Sexe', 'Telephone'], ...patients.map(patient => [patient.id, patient.name, patient.age, patient.sex, patient.phone])]
    const url = URL.createObjectURL(new Blob(['\uFEFF' + rows.map(row => row.map(quote).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a'); link.href = url; link.download = 'medihub-patients.csv'; link.click(); URL.revokeObjectURL(url)
  }

  async function createPatient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError('')
    const data = new FormData(event.currentTarget)
    try {
      const patient = await createStaffPatient({
        nom_patient: String(data.get('nom')).trim(), prenom_patient: String(data.get('prenom')).trim(),
        date_naissance: String(data.get('date_naissance')), sexe: String(data.get('sexe')) as 'F' | 'M',
        adresse: String(data.get('adresse')).trim(), numero_piece_identite: String(data.get('identite')).trim(),
        ...(canEditMedicalData ? { allergies: String(data.get('allergies')).trim(), antecedents_medicaux: String(data.get('antecedents')).trim(), groupe_sanguin: String(data.get('groupe_sanguin')) || undefined } : {}),
      })
      const phone = String(data.get('telephone') || '').trim()
      if (phone) {
        try { await addStaffPatientTelephone({ id_patient: patient.id_patient, numero_telephone: phone, type_telephone: 'principal' }) }
        catch (reason) { setShowCreate(false); onCreated(`Dossier créé, mais le téléphone n’a pas été enregistré : ${reason instanceof Error ? reason.message : 'erreur API'}`); return }
      }
      onCreated()
      setShowCreate(false)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'La création du dossier a échoué.') }
    finally { setSaving(false) }
  }

  return <>
    <div className="directory-toolbar"><div className="directory-search"><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Rechercher un patient par nom ou numero de dossier..."/><button className="btn-light" onClick={exportCsv} disabled={!patients.length}>Exporter CSV</button><button className="btn-primary" onClick={() => { setError(''); setShowCreate(true) }}>+ Nouveau patient</button></div></div>
    <div className="patient-record-layout"><section className="panel active-records"><div className="records-heading"><div><b>DOSSIERS DE {facilityName.toUpperCase()}</b><small>{patients.length} dossier{patients.length === 1 ? '' : 's'} transmis par le serveur</small></div><span className="count-pill">{patients.length}</span></div><div className="record-list">{patients.map(patient => <button key={patient.id} className={`record-entry ${selected?.id === patient.id ? 'chosen' : ''}`} onClick={() => setSelectedId(patient.id)}><div className={`record-photo avatar-${patient.color}`}>{patient.initials}</div><div className="record-name"><b>{patient.name}</b><small>{patient.id}</small></div><div className="record-meta"><span>{patient.groupeSanguin || 'Groupe sanguin non renseigne'}</span><small>{patient.age ? `${patient.age} ans` : 'Age non renseigne'} ? {patient.sex || 'Sexe non renseigne'}</small></div></button>)}</div>{!patients.length && <p className="saved-empty">Aucun dossier patient n'est encore associe a cet etablissement. Les patients charges depuis MediHub apparaitront ici.</p>}</section>
      {selected && <section className="patient-profile"><div className="panel patient-identity"><div className={`profile-photo avatar-${selected.color}`}>{selected.initials}</div><div className="profile-main"><h2>{selected.name}</h2><span className="profile-pills"><i>Dossier MediHub</i><i>{selected.age ? `${selected.age} ans` : 'Age non renseigne'} ? {selected.sex}</i></span><p>Dossier : {selected.id}</p><p>{selected.adresse || 'Adresse non renseignee'}</p><p>Telephone : {selected.phone}</p></div><div className="profile-actions"><button className="btn-primary" onClick={() => onStartConsultation(selected)}>Demarrer une consultation</button></div><div className="allergy-alert"><b>INFORMATIONS MEDICALES DU DOSSIER</b><span>Allergies : {selected.allergies || 'non renseignees'} ? Antecedents : {selected.antecedents || 'non renseignes'} ? Groupe sanguin : {selected.groupeSanguin || 'non renseigne'}</span></div></div><section className="panel civil-register"><div className="panel-head"><h2>Dossier rattache a {facilityName}</h2></div><div className="civil-cards"><article><small>IDENTITE</small><p>{selected.name}<br/>Sexe : {selected.sex || 'non renseigne'}<br/>Age : {selected.age || 'non renseigne'}<br/>Numero : {selected.id}</p></article><article><small>CONTACT</small><p>Telephone principal :<br/><b>{selected.phone}</b></p></article><article><small>DONNEES MEDICALES</small><p>Allergies : {selected.allergies || 'non renseignees'}<br/>Antecedents : {selected.antecedents || 'non renseignes'}<br/>Groupe sanguin : {selected.groupeSanguin || 'non renseigne'}</p></article></div></section>{!!selected.sharedHistories?.length && <section className="panel staff-shared-history"><div className="panel-head"><div><h2>Historique medical partage</h2><p>Historique transmis avec le consentement du patient</p></div><span className="count-pill">{selected.sharedHistories.length}</span></div>{selected.sharedHistories.map(history => <article key={history.id_historique_partage} className="staff-shared-record"><div><b>Etablissement source : {history.hopital_source}</b><small>Consentement : {new Date(history.date_consentement).toLocaleDateString('fr-FR')}</small></div><p>Allergies : {history.resume_medical.allergies || 'non renseignees'}<br/>Antecedents : {history.resume_medical.antecedents_medicaux || 'non renseignes'}<br/>Groupe sanguin : {history.resume_medical.groupe_sanguin || 'non renseigne'}</p>{history.resume_medical.mesures_poids?.map((measure, index) => <small className="staff-shared-weight" key={`${measure.date_mesure}-${index}`}>Poids : {measure.poids_kg} kg ? {measure.date_mesure}</small>)}</article>)}</section>}</section>}
    </div>
    {showCreate && <div className="modal-backdrop" onClick={() => !saving && setShowCreate(false)}><form className="modal staff-create-form" onSubmit={createPatient} onClick={event => event.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">DOSSIER HOSPITALIER</span><h2>Nouveau patient</h2></div><button type="button" className="close" onClick={() => setShowCreate(false)} disabled={saving}>×</button></div><div className="form-row"><label>Prénom<input name="prenom" maxLength={40} required autoFocus/></label><label>Nom<input name="nom" maxLength={40} required/></label></div><div className="form-row"><label>Date de naissance<input name="date_naissance" type="date" required/></label><label>Sexe<select name="sexe" required defaultValue=""><option value="" disabled>Choisir</option><option value="F">Femme</option><option value="M">Homme</option></select></label></div><label>Téléphone (facultatif)<input name="telephone" maxLength={20}/></label><label>Adresse<input name="adresse" maxLength={100}/></label><label>Numéro de pièce d’identité (facultatif)<input name="identite" maxLength={30}/></label>{canEditMedicalData && <><label>Allergies<input name="allergies" maxLength={300}/></label><label>Antécédents médicaux<input name="antecedents" maxLength={300}/></label><label>Groupe sanguin<select name="groupe_sanguin" defaultValue=""><option value="">Non renseigné</option>{['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(group => <option key={group}>{group}</option>)}</select></label></>}{error && <p className="auth-error" role="alert">{error}</p>}<p className="demo-hint">Le dossier sera créé dans PostgreSQL et rattaché à {facilityName}.</p><div className="modal-actions"><button type="button" className="btn-light" onClick={() => setShowCreate(false)} disabled={saving}>Annuler</button><button className="btn-primary" disabled={saving}>{saving ? 'Enregistrement…' : 'Créer le dossier'}</button></div></form></div>}
  </>
}

function RoleDashboard({ session, onNavigate }: { session: AuthSession; onNavigate: (page: string) => void }) {
  const allEntries: { permission: StaffPermission; page: string; label: string; detail: string; icon: string }[] = [
    { permission: 'appointments', page: 'Rendez-vous', label: 'Rendez-vous', detail: 'Consulter l’agenda et planifier une visite.', icon: '▦' },
    { permission: 'patients', page: 'Patients', label: 'Patients', detail: 'Accéder aux dossiers autorisés par votre rôle.', icon: '♙' },
    { permission: 'consultations', page: 'Consultations', label: 'Consultations', detail: 'Ouvrir et suivre les épisodes de consultation.', icon: '✚' },
    { permission: 'admissions', page: 'Hospitalisation', label: 'Hospitalisation', detail: 'Gérer les admissions et les lits.', icon: '▤' },
    { permission: 'laboratory', page: 'Laboratoire', label: 'Laboratoire', detail: 'Créer et consulter les prescriptions d’examens.', icon: '◉' },
    { permission: 'pharmacy', page: 'Pharmacie', label: 'Pharmacie', detail: 'Gérer les délivrances et le stock de votre établissement.', icon: '⌁' },
    { permission: 'billing', page: 'Facturation', label: 'Facturation', detail: 'Générer et consulter les factures.', icon: '▧' },
    { permission: 'staff', page: 'Personnel', label: 'Personnel', detail: 'Consulter la gestion des comptes et des rôles.', icon: '♧' },
  ]
  const entries = allEntries.filter(item => session.permissions.includes(item.permission))
  return <div className="role-dashboard"><div className="staff-overview-head"><div><span className="eyebrow">ESPACE PERSONNEL</span><h1>Bonjour, {session.user.name}</h1><p>{session.user.role} · {session.facility.name}</p></div><span className="shift-pill">● &nbsp;Session MediHub</span></div><div className="role-dashboard-grid">{entries.map(item => <button key={item.page} className="panel role-action-card" onClick={() => onNavigate(item.page)}><span>{item.icon}</span><div><b>{item.label}</b><small>{item.detail}</small></div><i>→</i></button>)}</div><p className="role-permission-note">Les modules affichés dépendent du rôle. Les permissions sont appliquées par le backend.</p></div>
}

function AccessDenied({ onReturn }: { onReturn: () => void }) {
  return <section className="panel access-denied"><span className="empty-icon">⌑</span><h1>Accès non disponible</h1><p>Ce profil ne dispose pas de l’autorisation nécessaire pour ouvrir ce module.</p><button className="btn-primary" onClick={onReturn}>Retour à mon tableau de bord</button></section>
}

function ModulePage({ page, onAdd, appointments }: { page: string; onAdd: () => void; appointments: AppointmentRecord[] }) {
  return <><ModuleLanding page={page} onAdd={onAdd} />
    {page === 'Rendez-vous' && <section className="panel saved-records"><div className="panel-head"><div><h2>Rendez-vous créés</h2><p>Synchronisés avec la base MediHub</p></div><strong>{appointments.length}</strong></div>{appointments.length ? <div className="registry-scroll"><table className="registry-table"><thead><tr><th>DATE & HEURE</th><th>PATIENT</th><th>PRATICIEN</th><th>MOTIF</th></tr></thead><tbody>{appointments.map(item => <tr key={item.id}><td>{item.date} · {item.time}</td><td><b>{item.patient}</b></td><td>{item.doctor}</td><td>{item.reason}</td></tr>)}</tbody></table></div> : <p className="saved-empty">Aucun rendez-vous créé pour le moment.</p>}</section>}
  </>
}
function ModuleLanding({ page, onAdd }: { page: string; onAdd: () => void }) {
  const info: Record<string, { eyebrow: string; text: string; button: string }> = {
    'Rendez-vous': { eyebrow: 'ORGANISATION DES SOINS', text: 'Consultez et planifiez les rendez-vous enregistr\u00e9s dans MediHub.', button: '+ Planifier un rendez-vous' },
    'Consultations': { eyebrow: 'PARCOURS DE SOINS', text: 'Suivez les consultations et les episodes de soins en cours.', button: '+ Ouvrir une consultation' },
    'Hospitalisation': { eyebrow: 'SEJOURS & LITS', text: "Visualisez l'occupation des lits et les admissions en attente.", button: '+ Nouvelle admission' },
    'Laboratoire': { eyebrow: 'EXAMENS & RESULTATS', text: 'Gerez le catalogue, les prescriptions du laboratoire et les resultats.', button: '+ Prescrire un examen' },
    'Pharmacie': { eyebrow: 'MEDICAMENTS & STOCK', text: 'Suivez les delivrances, les lots et les alertes de stock.', button: '+ Nouvelle delivrance' },
    'Facturation': { eyebrow: 'CAISSE & PAIEMENTS', text: 'Generez les factures des episodes clos et enregistrez les paiements.', button: '+ Generer une facture' },
    'Personnel': { eyebrow: "EQUIPE DE L'ETABLISSEMENT", text: 'Gerez les comptes, les roles et les affectations du personnel.', button: '+ Ajouter un membre' },
  }
  const data = info[page] || info['Rendez-vous']
  return <>
    <div className="page-heading"><div><span className="eyebrow">{data.eyebrow}</span><h1>{page}</h1><p>{data.text}</p></div><button className="btn-primary" onClick={onAdd}>{data.button}</button></div>
    {page !== 'Rendez-vous' && <div className="module-cards"><div className="panel module-empty"><div className="empty-icon">+</div><h2>Bienvenue dans {page.toLowerCase()}</h2><p>Cette vue reste a raccorder aux donnees MediHub de votre etablissement.</p><button className="btn-primary" onClick={onAdd}>{data.button}</button></div><div className="panel module-side"><span className="eyebrow">APERCU</span><h2>A suivre</h2><div className="module-info"><span className="info-icon sky">1</span><div><b>Elements du jour</b><small>Les donnees disponibles s'afficheront dans ce module.</small></div></div><div className="module-info"><span className="info-icon mint">OK</span><div><b>Donnees du serveur</b><small>Les actions raccordees sont enregistrees par MediHub.</small></div></div></div></div>}
  </>
}

export default App
