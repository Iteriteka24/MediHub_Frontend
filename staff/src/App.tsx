import { useEffect, useMemo, useState, type FormEvent } from 'react'
import './App.css'
import './reference-overrides.css'
import { AdmissionPage, AppointmentPage, ConsultationPage, DispensePage, ExternalDispensePage, initialMedicationLots, InvoicePage, LabOrderPage, type AdmissionRecord, type AppointmentRecord, type ConsultationRecord, type DispenseRecord, type InvoiceRecord, type LabOrderRecord, type MedicationLot } from './ActionPages'
import { AuthPage } from './AuthPage'
import { getStaffPatients, getStaffSession, logoutStaff, type SharedPatientHistory } from './api'
import { featureForPage, featureForRoute, homePageForRole, type AuthSession, type StaffPermission } from './auth'

type Patient = { initials: string; name: string; id: string; age: number; sex: string; phone: string; status: string; color: string; sharedHistories?: SharedPatientHistory[] }

const initialPatients: Patient[] = [
  { initials: 'AM', name: 'Aline Mukamana', id: 'PAT-2026-0248', age: 34, sex: 'Femme', phone: '+257 79 22 14 08', status: 'Actif', color: 'rose' },
  { initials: 'JN', name: 'Jean Ndayizeye', id: 'PAT-2026-0247', age: 52, sex: 'Homme', phone: '+257 68 40 12 91', status: 'En consultation', color: 'blue' },
  { initials: 'CM', name: 'Chantal Mbazumutima', id: 'PAT-2026-0246', age: 27, sex: 'Femme', phone: '+257 71 31 06 55', status: 'Actif', color: 'green' },
  { initials: 'PN', name: 'Patrick Niyonkuru', id: 'PAT-2026-0245', age: 41, sex: 'Homme', phone: '+257 69 51 80 23', status: 'Suivi requis', color: 'amber' },
  { initials: 'FN', name: 'Félicité Nshimirimana', id: 'PAT-2026-0244', age: 63, sex: 'Femme', phone: '+257 79 88 12 42', status: 'Actif', color: 'purple' },
]

const nav = [
  { group: 'PRINCIPAL', items: [['Vue d’ensemble', '◫'], ['Rendez-vous', '▦'], ['Patients', '♙']] },
  { group: 'ACTIVITÉS MÉDICALES', items: [['Consultations', '✚'], ['Hospitalisation', '▤'], ['Laboratoire', '◉']] },
  { group: 'GESTION', items: [['Pharmacie', '⌁'], ['Facturation', '▧'], ['Personnel', '♧']] },
]

function readSaved<T>(key: string): T[] {
  try { return JSON.parse(localStorage.getItem(key) || '[]') as T[] }
  catch { return [] }
}

function scopedKey(session: AuthSession | null, key: string) {
  return `medihub:${session?.facility.id || 'hospital-kira'}:${key}`
}

function App() {
  const [session, setSession] = useState<AuthSession | null>(null)
  const [checkingSession, setCheckingSession] = useState(true)
  const [page, setPage] = useState(() => session ? homePageForRole(session.user.role) : 'Vue d’ensemble')
  const [route, setRoute] = useState(() => window.location.pathname)
  const [query, setQuery] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [patients, setPatients] = useState<Patient[]>(() => readSaved<Patient>(scopedKey(session, 'patients')).length ? readSaved<Patient>(scopedKey(session, 'patients')) : session?.facility.type === 'independent-pharmacy' ? [] : initialPatients)
  const [notice, setNotice] = useState('')
  const [appointments, setAppointments] = useState<AppointmentRecord[]>(() => readSaved(scopedKey(session, 'appointments')))
  const [invoices, setInvoices] = useState<InvoiceRecord[]>(() => readSaved(scopedKey(session, 'invoices')))
  const [consultations, setConsultations] = useState<ConsultationRecord[]>(() => readSaved(scopedKey(session, 'consultations')))
  const [admissions, setAdmissions] = useState<AdmissionRecord[]>(() => readSaved(scopedKey(session, 'admissions')))
  const [labOrders, setLabOrders] = useState<LabOrderRecord[]>(() => readSaved(scopedKey(session, 'labOrders')))
  const [dispensations, setDispensations] = useState<DispenseRecord[]>(() => readSaved(scopedKey(session, 'dispensations')))
  const [medicationLots, setMedicationLots] = useState<MedicationLot[]>(() => readSaved<MedicationLot>(scopedKey(session, 'medicationLots')).length ? readSaved<MedicationLot>(scopedKey(session, 'medicationLots')) : initialMedicationLots)
  const filtered = useMemo(() => patients.filter((p) => `${p.name} ${p.id} ${p.phone}`.toLowerCase().includes(query.toLowerCase())), [patients, query])

  useEffect(() => {
    const syncRoute = () => setRoute(window.location.pathname)
    window.addEventListener('popstate', syncRoute)
    return () => window.removeEventListener('popstate', syncRoute)
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
    if (!session) return
    const key = (name: string) => scopedKey(session, name)
    const savedPatients = readSaved<Patient>(key('patients'))
    setPatients(savedPatients.length ? savedPatients : session.facility.type === 'independent-pharmacy' ? [] : initialPatients)
    setAppointments(readSaved(key('appointments'))); setInvoices(readSaved(key('invoices')))
    setConsultations(readSaved(key('consultations'))); setAdmissions(readSaved(key('admissions')))
    setLabOrders(readSaved(key('labOrders'))); setDispensations(readSaved(key('dispensations')))
    const savedLots = readSaved<MedicationLot>(key('medicationLots'))
    setMedicationLots(savedLots.length ? savedLots : initialMedicationLots)
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
        return { initials, name, id: record.id_patient, age, sex: record.sexe === 'F' ? 'Femme' : record.sexe === 'M' ? 'Homme' : record.sexe, phone: record.telephones?.[0]?.numero_telephone || 'Non renseigné', status: 'Actif', color: ['teal', 'blue', 'green', 'amber', 'purple'][index % 5], sharedHistories: record.historiques_medicaux_recus || [] }
      })
      setPatients(mapped)
    }).catch(error => {
      if (active) setNotice(error instanceof Error ? `Impossible de charger les dossiers patients : ${error.message}` : 'Impossible de charger les dossiers patients.')
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

  function saveAppointment(record: AppointmentRecord) {
    const next = [record, ...appointments]
    setAppointments(next)
    localStorage.setItem(scopedKey(session, 'appointments'), JSON.stringify(next))
  }

  function saveInvoice(record: InvoiceRecord) {
    const next = [record, ...invoices]
    setInvoices(next)
    localStorage.setItem(scopedKey(session, 'invoices'), JSON.stringify(next))
  }

  function saveLocal<T>(key: string, record: T, update: (records: T[]) => void, records: T[]) {
    const next = [record, ...records]
    update(next)
    localStorage.setItem(scopedKey(session, key.replace('medihub.', '')), JSON.stringify(next))
  }

  function saveDispensation(record: DispenseRecord, nextLots: MedicationLot[]) {
    saveLocal('medihub.dispensations', record, setDispensations, dispensations)
    setMedicationLots(nextLots)
    localStorage.setItem(scopedKey(session, 'medicationLots'), JSON.stringify(nextLots))
  }

  function addPatient(form: FormData) {
    const name = String(form.get('name') || '').trim()
    if (!name) return
    const initials = name.split(/\s+/).slice(0, 2).map((v) => v[0]).join('').toUpperCase()
    const next = [{ initials, name, id: `PAT-2026-0${patients.length + 249}`, age: Number(form.get('age')) || 0, sex: String(form.get('sex') || 'Femme'), phone: String(form.get('phone') || '—'), status: 'Actif', color: 'teal' }, ...patients]
    setPatients(next); localStorage.setItem(scopedKey(session, 'patients'), JSON.stringify(next))
    setShowAdd(false); setPage('Patients'); setNotice('Patient ajouté à la liste de démonstration.'); window.setTimeout(() => setNotice(''), 3500)
  }

  function updatePatient(updated: Patient) {
    const next = patients.map(patient => patient.id === updated.id ? updated : patient)
    setPatients(next)
    localStorage.setItem(scopedKey(session, 'patients'), JSON.stringify(next))
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
      <nav>{activeNav.map((section) => <div className="nav-group" key={section.group}><p>{section.group}</p>{section.items.map(([label, icon]) => <button key={label} className={`nav-item ${page === label ? 'active' : ''}`} onClick={() => { setPage(label); if (route !== '/') navigate('/') }}><span className="nav-icon">{icon}</span><span>{label}</span>{label === 'Rendez-vous' && <em>8</em>}</button>)}</div>)}</nav>
      <div className="sidebar-bottom"><button className="nav-item" onClick={() => setNotice('Centre d’aide : support@medihub.bi')}><span className="nav-icon">?</span>Aide & support</button><div className="user-card"><div className="avatar avatar-teal">{session.user.name.split(/\s+/).map(part => part[0]).slice(0, 2).join('')}</div><div><b>{session.user.name}</b><small>{session.user.role}</small></div></div></div>
    </aside>
    <main className="main-area">
      <header className="topbar"><div className="crumb">▦ &nbsp;{session.facility.name} <span>›</span> <b>{session.user.role}</b></div><div className="top-actions"><label className="global-search"><span>⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} onFocus={() => allowed('patients') && setPage('Patients')} placeholder="Rechercher" /></label>{allowed('pharmacy') && session.facility.type === 'hospital' && <button className="tenant-toggle" onClick={() => setPage('Pharmacie')}>⇄ &nbsp;Pharmacie partenaire</button>}<div className="today">◷ <span>7 nov. 2026</span></div><button className="icon-button" aria-label="Notifications" onClick={() => setNotice('Vous êtes à jour. Aucune nouvelle notification.')}>♧<i /></button><button className="top-logout" type="button" onClick={logout}><span aria-hidden="true">↪</span> Déconnexion</button><div className="top-avatar" title={session.user.name}>{session.user.name.split(/\s+/).map(part => part[0]).slice(0, 2).join('')}</div></div></header>
      <div className="content">
        {notice && <div className="toast">✓ &nbsp;{notice}<button onClick={() => setNotice('')}>×</button></div>}
        {!allowed(routeFeature || pageFeature) ? <AccessDenied onReturn={() => { navigate('/'); setPage(homePageForRole(session.user.role)) }} /> : route === '/rendez-vous/nouveau' ? <AppointmentPage onBack={() => { navigate('/'); setPage('Rendez-vous') }} onSave={saveAppointment} />
          : route === '/facturation/nouvelle' ? <InvoicePage patients={patients} onBack={() => { navigate('/'); setPage('Facturation') }} onSave={saveInvoice} />
          : route === '/consultations/nouvelle' ? <ConsultationPage patients={patients} initialPatientId={new URLSearchParams(window.location.search).get('patient') || undefined} onBack={() => { navigate('/'); setPage('Consultations') }} onSave={record => saveLocal('medihub.consultations', record, setConsultations, consultations)} />
          : route === '/hospitalisation/nouvelle' ? <AdmissionPage patients={patients} onBack={() => { navigate('/'); setPage('Hospitalisation') }} onSave={record => saveLocal('medihub.admissions', record, setAdmissions, admissions)} />
          : route === '/laboratoire/prescrire' ? <LabOrderPage patients={patients} onBack={() => { navigate('/'); setPage('Laboratoire') }} onSave={record => saveLocal('medihub.labOrders', record, setLabOrders, labOrders)} />
          : route === '/pharmacie/delivrance' ? session.facility.type === 'independent-pharmacy' ? <ExternalDispensePage lots={medicationLots} onBack={() => { navigate('/'); setPage('Pharmacie') }} onSave={saveDispensation} /> : <DispensePage patients={patients} lots={medicationLots} onBack={() => { navigate('/'); setPage('Pharmacie') }} onSave={saveDispensation} />
          : page === 'Vue d’ensemble' ? session.user.role === 'Administrateur' ? <Dashboard onNavigate={setPage} onAdd={() => setShowAdd(true)} /> : <RoleDashboard session={session} onNavigate={setPage} />
          : page === 'Patients' ? <Patients patients={filtered} query={query} setQuery={setQuery} onAdd={() => setShowAdd(true)} onUpdate={updatePatient} onStartConsultation={patient => { setPage('Consultations'); navigate(`/consultations/nouvelle?patient=${encodeURIComponent(patient.id)}`) }} />
          : page === 'Pharmacie' ? session.facility.type === 'independent-pharmacy' ? <IndependentPharmacyPage onCreate={() => navigate('/pharmacie/delivrance')} records={dispensations} lots={medicationLots} /> : <><PharmacyPage onValidate={() => navigate('/pharmacie/delivrance')} /><DispenseRegister records={dispensations} lots={medicationLots} onCreate={() => navigate('/pharmacie/delivrance')} /></>
          : <ModulePage page={page} appointments={appointments} invoices={invoices} consultations={consultations} admissions={admissions} labOrders={labOrders} onAdd={() => {
            const paths: Record<string, string> = { 'Rendez-vous': '/rendez-vous/nouveau', 'Facturation': '/facturation/nouvelle', 'Consultations': '/consultations/nouvelle', 'Hospitalisation': '/hospitalisation/nouvelle', 'Laboratoire': '/laboratoire/prescrire' }
            if (paths[page]) navigate(paths[page]); else setNotice(`Action ${page.toLowerCase()} prête pour la démonstration.`)
          }} />}
        <footer>© 2026 MediHub <span>•</span> Données de démonstration — non connectées au serveur</footer>
      </div>
    </main>
    {showAdd && <div className="modal-backdrop" onClick={() => setShowAdd(false)}><form className="modal" onSubmit={(e) => { e.preventDefault(); addPatient(new FormData(e.currentTarget)) }} onClick={(e) => e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">DOSSIER PATIENT</span><h2>Ajouter un patient</h2></div><button type="button" className="close" onClick={() => setShowAdd(false)}>×</button></div><label>Nom complet<input name="name" placeholder="Ex. Aline Mukamana" required autoFocus /></label><div className="form-row"><label>Âge<input name="age" type="number" min="0" placeholder="34" /></label><label>Sexe<select name="sex"><option>Femme</option><option>Homme</option><option>Autre</option></select></label></div><label>Téléphone<input name="phone" placeholder="+257 79 00 00 00" /></label><div className="modal-actions"><button type="button" className="btn-light" onClick={() => setShowAdd(false)}>Annuler</button><button className="btn-primary">Créer le dossier <span>→</span></button></div><p className="demo-hint">Enregistré uniquement dans cette session de démonstration.</p></form></div>}
  </div>
}

function Dashboard({ onNavigate, onAdd }: { onNavigate: (v: string) => void; onAdd: () => void }) {
  const appointments = [
    ['09:15', 'NK', 'Nkurunziza Diane', 'DOS-2024-0982 · 34 ans (F)', 'Crise palustre fébrile', 'Dr. J.P. Nkurunziza', 'Sans RDV · En cours', 'red'],
    ['09:45', 'BH', 'Bukuru Hilaire', 'DOS-2024-1104 · 48 ans (M)', 'Contrôle HTA / Diabète', 'Dr. A. Hakizimana', 'En attente', 'gray'],
    ['08:30', 'IN', 'Irakoze Nadia', 'DOS-2024-0412 · 19 ans (F)', 'Suture plaie avant-bras', 'Dr. P. Nduwayo', 'Acte terminé', 'teal'],
    ['10:00', 'GB', 'Gatabazi Bryan', 'DOS-2024-1290 · 6 ans (M)', 'Bronchopneumopathie aiguë', 'Dr. M. Nizigiyimana', 'En consultation', 'aqua'],
  ]
  const bedRows = [['Médecine interne', '18/20', 90, '2 lits disponibles'], ['Pédiatrie & Néonatologie', '9/12', 75, '3 berceaux libres · 1 couveuse libre'], ['Maternité & Obstétrique', '8/10', 80, '2 lits post-partum disponibles'], ['Chirurgie générale', '7/8', 87, '1 lit de surveillance post-op disponible']]
  return <>
    <div className="staff-overview-head"><div><span className="eyebrow">SUPERVISION GÉNÉRALE DE GARDE</span><h1>Supervision Générale de Garde</h1><span className="shift-pill">● &nbsp;Poste Journée (07:00 – 19:00 CAT)</span><p>Hôpital Kira · Secteur Démonstration</p></div><div className="quick-actions"><button className="btn-primary" onClick={onAdd}>＋ Nouveau patient</button><button className="btn-navy" onClick={() => onNavigate('Consultations')}>✚ Nouvelle consultation</button><button className="btn-light" onClick={() => onNavigate('Hospitalisation')}>▤ Attribuer un lit</button><button className="btn-light" onClick={() => onNavigate('Pharmacie')}>⌁ Délivrer médicaments</button></div></div>
    <div className="stats-grid staff-kpis"><Stat icon="▣" color="sky" label="Dossiers actifs" value="4 820" delta="↗ +12 % ce mois" note="" spark={[20,35,29,45,38,54,68,80]} /><Stat icon="▦" color="mint" label="RDV prévus" value="38" delta="14 honorés · 4 en attente" note="" spark={[30,25,44,36,54,43,65,55]} /><Stat icon="✚" color="lavender" label="Consultations" value="18" delta="● En consultation" note="" spark={[24,44,32,52,39,68,50,76]} /><Stat icon="▤" color="sky" label="Lits utilisés" value="42/50" delta="Occupation 84 %" note="" spark={[68,60,72,66,55,48,38,33]} /><Stat icon="◉" color="peach" label="Analyses labo" value="27" delta="En attente d’analyse" note="" spark={[45,40,55,48,61,52,73,62]} /><Stat icon="⌁" color="peach" label="Pharmacie" value="3 lots" delta="Alerte réapprovisionnement" note="" spark={[75,68,82,60,70,48,56,37]} /><Stat icon="▧" color="mint" label="Recettes du jour" value="8,45 M" delta="BIF · 62 actes soldés" note="" spark={[28,42,37,60,51,66,75,91]} /></div>
    <div className="staff-main-grid"><section className="panel registry-panel"><div className="panel-head"><div><h2>Rendez-vous & consultations du jour</h2><p>18 sur 38 dossiers traités</p></div><div className="registry-filters"><button className="selected">Tous (38)</button><button>Sans RDV (5)</button><button>En attente (4)</button><button>En cours (18)</button></div></div><div className="registry-scroll"><table className="registry-table"><thead><tr><th>HEURE</th><th>N° DOSSIER & PATIENT</th><th>MOTIF CLINIQUE</th><th>PRATICIEN ASSIGNÉ</th><th>STATUT SOIN</th></tr></thead><tbody>{appointments.map(([time, initials, name, id, reason, practitioner, status, tone]) => <tr key={id}><td>{time}</td><td><div className="registry-patient"><span className={`registry-avatar ${tone}`}>{initials}</span><span><b>{name}</b><small>{id}</small></span></div></td><td><b>{reason}</b><small>Consultation · Suivi clinique</small></td><td>♧ &nbsp;{practitioner}</td><td><span className={`care-status ${tone}`}>● &nbsp;{status}</span></td></tr>)}</tbody></table></div><div className="panel-foot"><span>Affichage de 4 sur 38 rendez-vous répertoriés</span><button onClick={() => onNavigate('Rendez-vous')}>Voir le registre complet →</button></div></section><div className="staff-right-column"><section className="panel bed-panel"><div className="panel-head"><h2>▣ Occupation des lits</h2><strong>42 / 50</strong></div>{bedRows.map(([ward, count, percent, note]) => <div className="bed-row" key={ward}><div><b>{ward}</b><span>{count} ({percent}%)</span></div><div className="bed-track"><i style={{ width: `${percent}%` }} /></div><small>{note}</small></div>)}<button className="wide-light" onClick={() => onNavigate('Hospitalisation')}>Consulter la matrice détaillée des lits</button></section><section className="panel priority-panel"><div className="panel-head"><h2>♧ Alertes prioritaires</h2><span className="alert-number">3 actions</span></div><div className="priority-row urgent"><b>◷ &nbsp;Consultation sans rendez-vous</b><small>Patient en attente d’évaluation médicale immédiate.</small></div><div className="priority-row"><b>◷ &nbsp;Surveillance glycémie</b><small>Contrôle HGT à 10:30 · Lit 08</small></div><div className="priority-row warning"><b>△ &nbsp;Alerte péremption proche</b><small>Ciprofloxacine 500 mg · Lot CPX-992 · 48 boîtes.</small></div><button className="all-alerts" onClick={() => onNavigate('Pharmacie')}>Consulter toutes les alertes →</button></section></div></div>
    <div className="staff-lower-grid"><section className="panel feed-panel"><div className="panel-head"><div><h2>Flux d’activité clinique en direct</h2><p>● Synchronisation temps réel · Réseau Démonstration</p></div></div><div className="feed-cards"><article><b>✚ Admission directe · Lit 14</b><small>Il y a 4 min · Patient N. Habimana</small><span>Chirurgie générale</span></article><article><b>◉ Hémogramme validé</b><small>Il y a 12 min · Anémie confirmée</small><span>Laboratoire central</span></article><article><b>▣ Prescription dispensée</b><small>Il y a 21 min · Lot ART-24-09</small><span>Pharmacie Démonstration</span></article></div></section><section className="panel queue-panel"><div className="panel-head"><div><h2>Consultations sans RDV</h2><p>File d’attente (4)</p></div></div>{initialPatients.slice(0,3).map((p,i)=><div className="queue-row" key={p.id}><div className={`avatar avatar-${p.color}`}>{p.initials}</div><div><b>{p.name}</b><small>Arrivé à 09:{20+i*10} · Hôpital Kira</small></div><span>{i===0?'En examen':'En attente médecin'}</span></div>)}</section></div>
  </>
}

function Stat({ icon, color, label, value, delta, note, spark }: { icon: string; color: string; label: string; value: string; delta: string; note: string; spark: number[] }) { return <div className="stat-card"><div className="stat-top"><span className={`stat-icon ${color}`}>{icon}</span><span className="stat-more">•••</span></div><p>{label}</p><div className="stat-bottom"><div><strong>{value}</strong><small><b>{delta}</b> · {note}</small></div><div className="sparkline">{spark.map((n, i) => <i key={i} style={{ height: `${n}%` }} />)}</div></div></div> }

function Patients({ patients, query, setQuery, onAdd, onUpdate, onStartConsultation }: { patients: Patient[]; query: string; setQuery: (v: string) => void; onAdd: () => void; onUpdate: (patient: Patient) => void; onStartConsultation: (patient: Patient) => void }) {
  const [filter, setFilter] = useState('Tous');
  const [selectedId, setSelectedId] = useState(patients[0]?.id || '');
  const [tab, setTab] = useState('Informations administratives');
  const [showEdit, setShowEdit] = useState(false)
  const list = patients.filter((p) => filter === 'Tous' || p.status === filter);
  const selected = list.find((p) => p.id === selectedId) || list[0];
  const tabs = ['Informations administratives', 'Assurance & Mutuelle', 'Antécédents & Allergies', 'Historique consultations', 'Hospitalisation'];
  function exportCsv() {
    const quote = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`
    const rows = [['N° dossier', 'Nom complet', 'Âge', 'Sexe', 'Téléphone', 'Statut'], ...list.map(p => [p.id, p.name, p.age, p.sex, p.phone, p.status])]
    const csv = '\uFEFF' + rows.map(row => row.map(quote).join(';')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a'); link.href = url; link.download = 'medihub-patients.csv'; link.click(); URL.revokeObjectURL(url)
  }
  return <>
    <div className="directory-toolbar"><div className="directory-search"><span>⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un patient par nom ou dossier..."/><button className="btn-light" onClick={exportCsv}>⇩ Exporter CSV</button><button className="btn-primary" onClick={onAdd}>＋ Enregistrer un patient</button></div><div className="directory-filters">{['Tous','En consultation','Actif','Suivi requis'].map((f) => <button key={f} className={filter===f?'selected':''} onClick={() => setFilter(f)}>{f}{f==='En consultation'&&<span>18</span>}</button>)}</div></div>
    <div className="security-banner"><span>♢</span><b>ACCÈS MÉDICAL SÉCURISÉ · RBAC ACTIF</b><span>Seuls les médecins et infirmiers accrédités peuvent modifier l’anamnèse, les allergies et les diagnostics CIM-10.</span><strong>Rôle : Médecin chef</strong><i>●</i></div>
    <div className="patient-record-layout"><section className="panel active-records"><div className="records-heading"><div><b>FILE ACTIVE · DÉMONSTRATION</b><small>{list.length} dossiers récents</small></div><span className="count-pill">{list.length}</span></div><div className="record-list">{list.map((p) => <button key={p.id} className={`record-entry ${selected?.id===p.id?'chosen':''}`} onClick={() => setSelectedId(p.id)}><div className={`record-photo avatar-${p.color}`}>{p.initials}</div><div className="record-name"><b>{p.name}</b><small>{p.id}</small></div><div className="record-meta"><span>{p.status==='En consultation'?'● En consultation':p.status==='Suivi requis'?'Lit MI-04':p.sex==='Femme'?'A+':'O+'}</span><small>{p.age} ans · {p.sex}</small></div></button>)}</div><div className="wait-stat"><div><small>Temps moyen d’attente</small><b>14 min</b></div><span>⌁⌁⌁⌁</span></div></section>
      {selected ? <section className="patient-profile"><div className="panel patient-identity"><div className={`profile-photo avatar-${selected.color}`}>{selected.initials}</div><div className="profile-main"><h2>{selected.name}</h2><span className="profile-pills"><i>{selected.status}</i><i>{selected.age} ans · {selected.sex}</i></span><p>▣ &nbsp;Dossier : {selected.id}</p><p>⌖ &nbsp;Gitega, Burundi</p><p>♧ &nbsp;Assurance santé · À vérifier</p></div><div className="profile-actions"><button className="btn-light">▤ Fiche</button><button className="btn-navy" onClick={() => setTab('Historique consultations')}>⊟ Bilan labo</button><button className="btn-primary" onClick={() => onStartConsultation(selected)}>✚ Démarrer consultation</button></div><div className="allergy-alert"><b>△ &nbsp;INFORMATIONS CLINIQUES À CONFIRMER</b><span>Vérifier allergies et antécédents avec le patient avant toute prescription.</span></div></div><nav className="record-tabs">{tabs.map((t,i)=><button key={t} className={tab===t?'selected':''} onClick={() => setTab(t)}>{['♙','♧','⌕','▣','▤'][i]} &nbsp;{t}</button>)}</nav><div className="panel civil-register"><div className="panel-head"><h2>▣ {tab==='Informations administratives'?'Registre d’état civil & contacts':tab}</h2><button className="btn-light" onClick={() => setShowEdit(true)}>✎ Modifier infos</button></div><div className="civil-cards"><article><small>IDENTITÉ NATIONALE</small><p>Nom complet : {selected.name}<br/>Sexe : {selected.sex}<br/>Âge : {selected.age} ans<br/>N° patient : {selected.id}<br/>Établissement : Hôpital Kira</p></article><article><small>TÉLÉPHONES & CONTACTS</small><p>Téléphone principal :<br/><b>{selected.phone}</b><br/>Courriel : non renseigné<br/>Contact d’urgence : à compléter</p></article><article><small>RÉSIDENCE PRINCIPALE</small><p>Commune : Gitega<br/>Province : Gitega<br/>Quartier : à compléter<br/>Profession : non renseignée</p></article></div><div className="record-consent">♧ &nbsp;Informations de dossier affichées selon le rôle actif. Les accès sensibles sont journalisés.</div></div>
        {!!selected.sharedHistories?.length && <section className="panel staff-shared-history"><div className="panel-head"><div><h2>Historique médical partagé</h2><p>Résumé transmis avec le consentement du patient</p></div><span className="count-pill">{selected.sharedHistories.length}</span></div>{selected.sharedHistories.map(history => <article key={history.id_historique_partage} className="staff-shared-record"><div><b>Établissement source : {history.hopital_source}</b><small>Consentement enregistré le {new Date(history.date_consentement).toLocaleString('fr-FR')}</small></div><p>Allergies : {history.resume_medical.allergies || 'non renseignées'}<br/>Antécédents : {history.resume_medical.antecedents_medicaux || 'non renseignés'}<br/>Groupe sanguin : {history.resume_medical.groupe_sanguin || 'non renseigné'}</p>{history.resume_medical.mesures_poids?.map((measure, index) => <small className="staff-shared-weight" key={`${measure.date_mesure}-${index}`}>Poids : {measure.poids_kg} kg · {measure.date_mesure}</small>)}{history.documents.length > 0 && <div className="staff-shared-documents"><b>Documents reçus</b>{history.documents.map(document => <div key={document.id_document_partage}><span>{document.titre}</span><small>{document.type_document.replaceAll('_', ' ')} · {document.date_document || 'Date non renseignée'}</small></div>)}</div>}</article>)}</section>}
      </section> : <div className="panel empty-state">Aucun dossier ne correspond aux critères de recherche.</div>}
    {showEdit && selected && <EditPatientModal patient={selected} onClose={() => setShowEdit(false)} onSave={patient => { onUpdate(patient); setShowEdit(false) }} />}
    </div>
  </>
}

function EditPatientModal({ patient, onClose, onSave }: { patient: Patient; onClose: () => void; onSave: (patient: Patient) => void }) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const name = String(data.get('name') || '').trim()
    if (!name) return
    onSave({ ...patient, name, initials: name.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase(), age: Number(data.get('age')) || 0, sex: String(data.get('sex')), phone: String(data.get('phone') || '').trim() })
  }
  return <div className="modal-backdrop" onClick={onClose}><form className="modal" onSubmit={submit} onClick={event => event.stopPropagation()}>
    <div className="modal-head"><div><span className="eyebrow">DOSSIER {patient.id}</span><h2>Modifier les informations</h2></div><button type="button" className="close" aria-label="Fermer" onClick={onClose}>×</button></div>
    <label>Nom complet<input name="name" defaultValue={patient.name} required autoFocus /></label>
    <div className="form-row"><label>Âge<input name="age" type="number" min="0" defaultValue={patient.age} required /></label><label>Sexe<select name="sex" defaultValue={patient.sex}><option>Femme</option><option>Homme</option><option>Autre</option></select></label></div>
    <label>Téléphone<input name="phone" defaultValue={patient.phone} /></label>
    <div className="modal-actions"><button type="button" className="btn-light" onClick={onClose}>Annuler</button><button className="btn-primary">Enregistrer les modifications</button></div>
    <p className="demo-hint">Les modifications sont conservées dans ce navigateur.</p>
  </form></div>
}

function PharmacyPage({ onValidate }: { onValidate: () => void }) {
  return <div className="pharmacy-screen"><section className="panel pharmacy-patient"><div className="pharm-patient-avatar avatar-blue">CM</div><div className="pharm-patient-details"><h1>Mme Chantal M.</h1><span className="profile-pills"><i>▤ Médecine interne · Lit B-14</i><i>Assurance MFP · 80 %</i></span><p>▣ &nbsp;Dossier PAT-2026-0246 &nbsp; · &nbsp; 27 ans &nbsp; · &nbsp; Hôpital Kira</p><p className="pharm-allergy">△ &nbsp;Allergies : vérifier avec le dossier médical avant délivrance</p></div><div className="active-prescription"><small>ORDONNANCE ACTIVE</small><b>▤ &nbsp;#ORD-7741 · 7 nov. 2026</b><span>Prescripteur : Dr. Aline M.</span><small>STATUT ORDONNANCE</small><strong>● &nbsp;Vérifiée & prête pour délivrance</strong><small>Dispensation : Pharmacie de l’Hôpital Kira</small></div></section>
    <div className="pharmacy-workspace"><div className="prescription-lines"><div className="fefo-banner"><span>⌕</span><div><b>STANDARD DE TRAÇABILITÉ RG40 · FEFO MULTI-LOTS</b><p>Quand un lot ne couvre pas toute la quantité prescrite, la délivrance est répartie automatiquement en privilégiant les dates de péremption les plus proches.</p></div></div>
      <section className="panel medicine-line"><div className="medicine-header"><span className="medicine-icon">✚</span><div><h2>Amoxicilline + Acide Clavulanique 1 g <i>Oral / Antibactérien</i></h2><p>Posologie : 1 comprimé × 2 / jour pendant 10 jours · Code ATC : J01CR02</p></div></div><div className="quantity-summary"><span>QUANTITÉ PRESCRITE <b>20 <small>comprimés</small></b></span><span>QUANTITÉ ALLOUÉE <b className="teal-text">20 / 20 <small>complets</small></b></span></div><div className="multi-lot-note">↗ &nbsp;Multi-lots appliqué (RG40) : la quantité demandée est fournie via 2 lots pour préserver la traçabilité. <b>Split automatique 12 + 8</b></div><div className="lot-table"><div className="lot-row lot-heading"><b>N° DE LOT</b><b>DATE DE PÉREMPTION</b><b>STOCK DISPONIBLE</b><b>QTÉ DEMANDÉE</b><b>QTÉ DÉLIVRÉE</b><b>PRIX UNITAIRE</b></div><div className="lot-row"><b>#LOT-2026-A <small>Rayon A-04</small></b><span className="expiry-good">12/2026<br/><small>(&gt; 6 mois)</small></span><span>12 compr.<br/><small className="danger-text">(Épuisement)</small></span><span>12 compr.</span><b>12 compr.</b><span>1 200 BIF<br/><b>14 400 BIF</b></span></div><div className="lot-row"><b>#LOT-2026-B <small>Rayon A-05</small></b><span className="expiry-good">08/2027<br/><small>(&gt; 6 mois)</small></span><span>35 compr.<br/><small>(Reste 27)</small></span><span>8 compr.</span><b>8 compr.</b><span>1 200 BIF<br/><b>9 600 BIF</b></span></div></div><div className="lot-total"><span>▥ &nbsp;Code-barres scannés : BC-AMX-2026A-091 · BC-AMX-2026B-114</span><b>Sous-total ligne 1 : 24 000 BIF</b></div></section>
      <section className="panel medicine-line"><div className="medicine-header"><span className="medicine-icon blue">▤</span><div><h2>Paracétamol 500 mg IV · Flacon 100 ml <i className="neutral-pill">Intraveineux / Antalgique</i></h2><p>Perfusion continue lente : 1 flacon toutes les 8 heures · Code ATC : N02BE01</p></div></div><div className="quantity-summary"><span>QUANTITÉ PRESCRITE <b>3 <small>flacons</small></b></span><span>QUANTITÉ ALLOUÉE <b className="teal-text">3 / 3 <small>mono-lot</small></b></span></div><div className="lot-table"><div className="lot-row lot-heading"><b>N° DE LOT</b><b>DATE DE PÉREMPTION</b><b>STOCK DISPONIBLE</b><b>QTÉ DEMANDÉE</b><b>QTÉ DÉLIVRÉE</b><b>PRIX UNITAIRE</b></div><div className="lot-row"><b>#LOT-PAR-90 <small>Chariot urgence B</small></b><span className="expiry-good">11/2026<br/><small>(&gt; 6 mois)</small></span><span>48 flacons</span><span>3 flacons</span><b>3 flacons</b><span>3 500 BIF<br/><b>10 500 BIF</b></span></div></div><div className="lot-total"><span>▥ &nbsp;Code-barres scanné : BC-PAR-90-8820</span><b>Sous-total ligne 2 : 10 500 BIF</b></div></section><div className="expiry-legend">ⓘ &nbsp; Légende péremption système : <span>● Optimal (&gt; 6 mois)</span><span>● Surveillance (3 à 6 mois)</span><span className="danger-text">● Alerte critique (&lt; 3 mois)</span></div></div>
      <aside className="pharmacy-summary"><section className="panel basket-panel"><div className="panel-head"><h2>▣ Récapitulatif panier RG40</h2><span className="count-pill">2 articles / 23 unités</span></div><div className="basket-row"><span>Amoxicilline + Ac. Clav. 1 g<small>20 compr. (Lots A + B)</small></span><b>24 000 BIF</b></div><div className="basket-row"><span>Paracétamol 500 mg IV<small>3 flacons (Lot PAR-90)</small></span><b>10 500 BIF</b></div><div className="basket-total"><span>Montant total brut</span><b>34 500 BIF</b></div><div className="insurance-box"><span>♢ &nbsp;Part assurance MFP (80%)</span><b>− 27 600 BIF</b><small>Prise en charge active · MFP-BUJ-8819</small><hr/><span>Reste à charge patient <b>6 900 BIF</b></span></div><small className="section-label">MODE D’IMPUTATION COMPTABLE</small><label className="radio-card"><input type="radio" name="charge" defaultChecked/><span><b>Ajouter à la facture de l’épisode en cours</b><small>Dossier PAT-2026-0246 · Hospitalisation Médecine interne</small></span></label><label className="radio-card"><input type="radio" name="charge"/><span><b>Paiement immédiat comptoir</b><small>Règlement direct espèces / Ecocash / Lumicash</small></span></label><div className="pharmacist"><span className="avatar avatar-teal">AN</span><div><b>Pharm. A. Ndayisenga</b><small>Matricule : PH-BJM-042</small></div><span>⚙</span></div><button className="validate-dispensation" onClick={onValidate}>✓ &nbsp;Valider la délivrance & décrémenter les lots</button><div className="secondary-actions"><button>▤ Bordereau RG40</button><button>◷ Délivrance partielle</button></div></section><section className="panel audit-panel"><div className="panel-head"><h2>Audit & sécurité FEFO</h2><span>● Synchronisé</span></div><p>Dernier inventaire physique : <b>07/11/2026 · 07:30</b></p><p>Contrôle antibiotiques : <strong>Conforme</strong></p></section></aside>
    </div>
  </div>
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
  return <div className="role-dashboard"><div className="staff-overview-head"><div><span className="eyebrow">ESPACE PERSONNEL</span><h1>Bonjour, {session.user.name}</h1><p>{session.user.role} · {session.facility.name}</p></div><span className="shift-pill">● &nbsp;Session de démonstration</span></div><div className="role-dashboard-grid">{entries.map(item => <button key={item.page} className="panel role-action-card" onClick={() => onNavigate(item.page)}><span>{item.icon}</span><div><b>{item.label}</b><small>{item.detail}</small></div><i>→</i></button>)}</div><p className="role-permission-note">Les modules affichés correspondent au profil de démonstration. En production, le backend imposera les permissions sur chaque requête.</p></div>
}

function AccessDenied({ onReturn }: { onReturn: () => void }) {
  return <section className="panel access-denied"><span className="empty-icon">⌑</span><h1>Accès non disponible</h1><p>Ce profil ne dispose pas de l’autorisation nécessaire pour ouvrir ce module.</p><button className="btn-primary" onClick={onReturn}>Retour à mon tableau de bord</button></section>
}

function IndependentPharmacyPage({ onCreate, records, lots }: { onCreate: () => void; records: DispenseRecord[]; lots: MedicationLot[] }) {
  return <div className="independent-pharmacy"><div className="page-heading"><div><span className="eyebrow">ESPACE PARTENAIRE · ENTITÉ INDÉPENDANTE</span><h1>Pharmacie Centrale Rohero</h1><p>Votre compte et votre stock sont séparés de ceux des hôpitaux.</p></div><button className="btn-primary" onClick={onCreate}>＋ Valider une délivrance partenaire</button></div><div className="partner-boundary"><b>Établissement autonome</b><span>Aucun hôpital n’est rattaché par défaut. Les ordonnances partenaires seront vérifiées par le backend lors de son intégration.</span></div><DispenseRegister records={records} lots={lots} onCreate={onCreate} /></div>
}

function ModulePage({ page, onAdd, appointments, invoices, consultations, admissions, labOrders }: { page: string; onAdd: () => void; appointments: AppointmentRecord[]; invoices: InvoiceRecord[]; consultations: ConsultationRecord[]; admissions: AdmissionRecord[]; labOrders: LabOrderRecord[] }) {
  return <><ModuleLanding page={page} onAdd={onAdd} />
    {page === 'Rendez-vous' && <section className="panel saved-records"><div className="panel-head"><div><h2>Rendez-vous créés</h2><p>Enregistrés dans ce navigateur</p></div><strong>{appointments.length}</strong></div>{appointments.length ? <div className="registry-scroll"><table className="registry-table"><thead><tr><th>DATE & HEURE</th><th>PATIENT</th><th>PRATICIEN</th><th>MOTIF</th></tr></thead><tbody>{appointments.map((item) => <tr key={item.id}><td>{item.date} · {item.time}</td><td><b>{item.patient}</b></td><td>{item.doctor}</td><td>{item.reason}</td></tr>)}</tbody></table></div> : <p className="saved-empty">Aucun rendez-vous créé pour le moment.</p>}</section>}
    {page === 'Facturation' && <section className="panel saved-records"><div className="panel-head"><div><h2>Factures générées</h2><p>Enregistrées dans ce navigateur</p></div><strong>{invoices.length}</strong></div>{invoices.length ? <div className="registry-scroll"><table className="registry-table"><thead><tr><th>NUMÉRO</th><th>PATIENT</th><th>DATE</th><th>TOTAL</th><th>PART PATIENT</th></tr></thead><tbody>{invoices.map((item) => <tr key={item.id}><td>{item.id}</td><td><b>{item.patient}</b></td><td>{item.date}</td><td>{item.total.toLocaleString('fr-FR')} BIF</td><td>{item.patientShare.toLocaleString('fr-FR')} BIF</td></tr>)}</tbody></table></div> : <p className="saved-empty">Aucune facture générée pour le moment.</p>}</section>}
    {page === 'Consultations' && <RecordPanel title="Consultations ouvertes" records={consultations.map(item => [item.id, item.patient, item.date, item.reason, item.doctor])} headings={['RÉFÉRENCE', 'PATIENT', 'DATE', 'MOTIF', 'PRATICIEN']} />}
    {page === 'Hospitalisation' && <RecordPanel title="Admissions enregistrées" records={admissions.map(item => [item.id, item.patient, item.date, item.service, `Lit ${item.bed}`])} headings={['RÉFÉRENCE', 'PATIENT', 'DATE', 'SERVICE', 'LIT']} />}
    {page === 'Laboratoire' && <RecordPanel title="Prescriptions envoyées" records={labOrders.map(item => [item.id, item.patient, item.date, item.exam, item.priority])} headings={['RÉFÉRENCE', 'PATIENT', 'DATE', 'EXAMEN', 'PRIORITÉ']} />}
  </>
}

function RecordPanel({ title, records, headings }: { title: string; records: string[][]; headings: string[] }) {
  return <section className="panel saved-records"><div className="panel-head"><div><h2>{title}</h2><p>Enregistrés dans ce navigateur</p></div><strong>{records.length}</strong></div>{records.length ? <div className="registry-scroll"><table className="registry-table"><thead><tr>{headings.map(heading => <th key={heading}>{heading}</th>)}</tr></thead><tbody>{records.map((row, index) => <tr key={`${row[0]}-${index}`}>{row.map((value, cell) => <td key={`${cell}-${value}`}>{cell === 0 ? <b>{value}</b> : value}</td>)}</tr>)}</tbody></table></div> : <p className="saved-empty">Aucun élément enregistré pour le moment.</p>}</section>
}

function DispenseRegister({ records, lots, onCreate }: { records: DispenseRecord[]; lots: MedicationLot[]; onCreate: () => void }) {
  return <section className="panel saved-records"><div className="panel-head"><div><h2>Registre des délivrances & niveaux de stock</h2><p>Les sorties enregistrées décrémentent le lot correspondant.</p></div><button className="btn-primary" onClick={onCreate}>＋ Nouvelle délivrance</button></div><div className="lot-stock-grid">{lots.map(lot => <article key={lot.id}><small>{lot.id}</small><b>{lot.medication}</b><span>{lot.stock} {lot.unit} en stock</span></article>)}</div>{records.length ? <div className="registry-scroll"><table className="registry-table"><thead><tr><th>RÉFÉRENCE</th><th>DATE</th><th>PATIENT</th><th>MÉDICAMENT</th><th>LOT</th><th>QTÉ</th><th>RESTE EN STOCK</th></tr></thead><tbody>{records.map(item => <tr key={item.id}><td>{item.id}</td><td>{item.date}</td><td>{item.patient}</td><td>{item.medication}</td><td>{item.lot}</td><td>{item.quantity}</td><td>{item.stockAfter}</td></tr>)}</tbody></table></div> : <p className="saved-empty">Aucune délivrance validée pour le moment.</p>}</section>
}

function ModuleLanding({ page, onAdd }: { page: string; onAdd: () => void }) { const info: Record<string, { eyebrow: string; text: string; button: string }> = { 'Rendez-vous': { eyebrow: 'ORGANISATION DES SOINS', text: 'Consultez les rendez-vous, les disponibilités et les demandes des patients.', button: '＋ Planifier un rendez-vous' }, 'Consultations': { eyebrow: 'PARCOURS DE SOINS', text: 'Suivez les consultations et les épisodes de soins en cours.', button: '＋ Ouvrir une consultation' }, 'Hospitalisation': { eyebrow: 'SÉJOURS & LITS', text: 'Visualisez l’occupation des lits et les admissions en attente.', button: '＋ Nouvelle admission' }, 'Laboratoire': { eyebrow: 'EXAMENS & RÉSULTATS', text: 'Gérez le catalogue, les prescriptions d’examens et les résultats.', button: '＋ Prescrire un examen' }, 'Pharmacie': { eyebrow: 'MÉDICAMENTS & STOCK', text: 'Suivez les délivrances, les lots et les alertes de stock.', button: '＋ Nouvelle délivrance' }, 'Facturation': { eyebrow: 'CAISSE & PAIEMENTS', text: 'Générez les factures des épisodes clos et enregistrez les paiements.', button: '＋ Générer une facture' }, 'Personnel': { eyebrow: 'ÉQUIPE DE L’ÉTABLISSEMENT', text: 'Gérez les comptes, les rôles et les affectations du personnel.', button: '＋ Ajouter un membre' } }; const data = info[page] || info['Rendez-vous']; return <><div className="page-heading"><div><span className="eyebrow">{data.eyebrow}</span><h1>{page}</h1><p>{data.text}</p></div><button className="btn-primary" onClick={onAdd}>{data.button}</button></div><div className="module-cards"><div className="panel module-empty"><div className="empty-icon">{page === 'Pharmacie' ? '⌁' : page === 'Rendez-vous' ? '▦' : '✚'}</div><h2>{page === 'Rendez-vous' ? 'Votre agenda est prêt' : `Bienvenue dans ${page.toLowerCase()}`}</h2><p>Cette vue est préparée pour le raccordement à l’API MediHub. Pour l’instant, les interactions utilisent des données de démonstration.</p><button className="btn-primary" onClick={onAdd}>{data.button}</button></div><div className="panel module-side"><span className="eyebrow">APERÇU</span><h2>À suivre</h2><div className="module-info"><span className="info-icon sky">◷</span><div><b>Éléments du jour</b><small>Votre liste se mettra à jour à la connexion de l’API.</small></div></div><div className="module-info"><span className="info-icon mint">✓</span><div><b>Données isolées</b><small>Aucune donnée n’est envoyée à un serveur.</small></div></div><div className="module-info"><span className="info-icon lavender">↗</span><div><b>Prêt à intégrer</b><small>Les appels API pourront être ajoutés dans les services frontend.</small></div></div></div></div></> }

export default App
