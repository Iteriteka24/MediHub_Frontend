import { useEffect, useState } from 'react'
import { getDashboardStatistics, getStaffMembers, type DashboardStatistics } from './api'

type PatientSummary = { initials: string; name: string; id: string; age: number; sex: string; phone: string }

export function Dashboard({ facilityName, patients, onNavigate }: { facilityName: string; patients: PatientSummary[]; onNavigate: (page: string) => void }) {
  const [statistics, setStatistics] = useState<DashboardStatistics | null>(null)
  const [staffCount, setStaffCount] = useState<number | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const refresh = () => {
      Promise.all([getDashboardStatistics(), getStaffMembers()]).then(([data, members]) => {
        if (active) {
          setStatistics(data)
          setStaffCount(Array.isArray(members) ? members.length : members.results.length)
          setError('')
        }
      }).catch(reason => {
        if (active) setError(reason instanceof Error ? reason.message : 'Les statistiques ne sont pas disponibles.')
      })
    }
    refresh()
    const interval = window.setInterval(refresh, 15000)
    window.addEventListener('focus', refresh)
    return () => {
      active = false
      window.clearInterval(interval)
      window.removeEventListener('focus', refresh)
    }
  }, [])

  const currency = (value: string | number | undefined) => value === undefined ? '—' : `${Number(value).toLocaleString('fr-FR')} BIF`
  const metrics = [
    ['Dossiers patients', String(patients.length), 'Dossiers enregistrés dans cet établissement'],
    ['Personnel', String(staffCount ?? '-'), 'Comptes MediHub de cet etablissement'],
    ['Rendez-vous du mois', String(statistics?.soins?.rendez_vous ?? '—'), `${statistics?.soins?.rendez_vous_planifies ?? '—'} planifiés`],
    ['Rendez-vous a venir', String(statistics?.soins?.rendez_vous_a_venir ?? '-'), 'Rendez-vous planifies dans cet etablissement'],
    ['Consultations du mois', String(statistics?.soins?.consultations ?? '—'), 'Données du serveur MediHub'],
    ['Hospitalisations en cours', String(statistics?.soins?.hospitalisations_en_cours ?? '—'), 'Patients actuellement hospitalisés'],
    ['Examens en attente', String(statistics?.laboratoire?.examens_en_attente ?? '—'), 'Prescriptions non réalisées'],
    ['Médicaments sous le seuil', String(statistics?.pharmacie?.medicaments_sous_seuil ?? '—'), 'Alertes de stock actuelles'],
    ['Paiements reçus', currency(statistics?.facturation?.paiements_recus), 'Montant de la période en cours'],
  ]

  return <>
    <div className="staff-overview-head"><div><span className="eyebrow">TABLEAU DE BORD DE L’ÉTABLISSEMENT</span><h1>{facilityName}</h1><p>Indicateurs chargés depuis les dossiers et les activités enregistrés dans MediHub.</p></div><span className="shift-pill">● &nbsp;Données du serveur</span></div>
    {error && <div className="staff-api-error" role="alert">Les statistiques n’ont pas pu être chargées : {error}</div>}
    <div className="stats-grid staff-kpis">{metrics.map(([label, value, detail], index) => <article className="stat-card" key={label}><div className="stat-top"><span className={`stat-icon ${['sky', 'mint', 'mint', 'lavender', 'sky', 'sky', 'peach', 'peach', 'mint'][index]}`}>{['\u25a3', '\u2667', '\u25a6', '\u25a6', '\u271a', '\u25a4', '\u25c9', '\u2301', '\u25a7'][index]}</span></div><p>{label}</p><div className="stat-bottom"><div><strong>{value}</strong><small>{detail}</small></div></div></article>)}</div>
    <section className="panel saved-records dashboard-patients"><div className="panel-head"><div><h2>Dossiers récemment chargés</h2><p>Liste réelle renvoyée par l’API patients de cet établissement</p></div><button className="btn-light" onClick={() => onNavigate('Patients')}>Ouvrir les dossiers</button></div>
      {patients.length ? <div className="registry-scroll"><table className="registry-table"><thead><tr><th>PATIENT</th><th>NUMÉRO DE DOSSIER</th><th>ÂGE</th><th>SEXE</th><th>TÉLÉPHONE</th></tr></thead><tbody>{patients.slice(0, 8).map(patient => <tr key={patient.id}><td><b>{patient.name}</b></td><td>{patient.id}</td><td>{patient.age ? `${patient.age} ans` : 'Non renseigné'}</td><td>{patient.sex || 'Non renseigné'}</td><td>{patient.phone}</td></tr>)}</tbody></table></div> : <p className="saved-empty">Aucun dossier patient n’est encore associé à cet établissement. Les nouveaux dossiers apparaîtront ici après leur enregistrement dans MediHub.</p>}
    </section>
  </>
}
