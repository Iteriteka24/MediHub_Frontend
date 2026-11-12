import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { createStaffMember, getStaffMembers, type StaffMember, type StaffMemberInput } from './api'

const roles = [
  ['medecin', 'Médecin'],
  ['infirmier', 'Infirmier'],
  ['secretaire', 'Réceptionniste'],
  ['pharmacien', 'Pharmacien'],
  ['comptable', 'Comptable'],
  ['technicien_labo', 'Technicien de laboratoire'],
  ['administrateur', 'Administrateur'],
] as const

function recordsOf(response: StaffMember[] | { results: StaffMember[] }) {
  return Array.isArray(response) ? response : response.results
}

export function PersonnelPage({ canManage, facilityType, onNotice }: { canManage: boolean; facilityType: 'hospital' | 'hospital-pharmacy' | 'independent-pharmacy'; onNotice: (message: string) => void }) {
  const [members, setMembers] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selectedRole, setSelectedRole] = useState(facilityType === 'hospital' ? 'infirmier' : 'pharmacien')
  const establishmentRoles = roles.filter(([value]) => {
    if (value === 'administrateur') return false
    return facilityType === 'hospital' ? value !== 'pharmacien' : value === 'pharmacien'
  })

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setMembers(recordsOf(await getStaffMembers()))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Impossible de charger le personnel.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')
    const form = new FormData(event.currentTarget)
    const data: StaffMemberInput = {
      nom: String(form.get('nom') || '').trim(),
      prenom: String(form.get('prenom') || '').trim(),
      email_professionnel: String(form.get('email_professionnel') || '').trim(),
      role_metier: String(form.get('role_metier') || ''),
      date_embauche: String(form.get('date_embauche') || ''),
      identifiant_connexion: String(form.get('identifiant_connexion') || '').trim(),
      role_acces: 'standard',
      password: String(form.get('password') || ''),
    }
    if (data.role_metier === 'medecin') data.specialite = String(form.get('specialite') || '').trim()
    try {
      await createStaffMember(data)
      setShowForm(false)
      await refresh()
      onNotice('Le membre a été créé dans MediHub.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'La création du membre a échoué.')
    } finally {
      setSaving(false)
    }
  }

  return <>
    <div className="page-heading">
      <div><span className="eyebrow">ÉQUIPE DE L’ÉTABLISSEMENT</span><h1>Personnel</h1><p>Les comptes et rôles affichés proviennent de la base MediHub de cet établissement.</p></div>
      {canManage && <button className="btn-primary" onClick={() => { setError(''); setSelectedRole(facilityType === 'hospital' ? 'infirmier' : 'pharmacien'); setShowForm(true) }}>＋ Ajouter un membre</button>}
    </div>
    <section className="panel saved-records">
      <div className="panel-head"><div><h2>Membres de l’établissement</h2><p>{members.length} compte{members.length === 1 ? '' : 's'} enregistré{members.length === 1 ? '' : 's'}</p></div><button className="btn-light" onClick={() => void refresh()} disabled={loading}>Actualiser</button></div>
      {loading ? <p className="saved-empty">Chargement depuis le serveur…</p> : error && !members.length ? <div className="saved-empty" role="alert">{error}</div> : members.length ? <div className="registry-scroll"><table className="registry-table"><thead><tr><th>NOM</th><th>IDENTIFIANT</th><th>RÔLE</th><th>EMAIL PROFESSIONNEL</th><th>STATUT</th></tr></thead><tbody>{members.map(member => <tr key={member.matricule_personnel}><td><b>{member.prenom} {member.nom}</b></td><td>{member.identifiant_connexion}</td><td>{roles.find(([value]) => value === member.role_metier)?.[1] || member.role_metier}{member.specialite_medecin ? ` · ${member.specialite_medecin}` : ''}</td><td>{member.email_professionnel}</td><td>{member.actif ? 'Actif' : 'Inactif'}</td></tr>)}</tbody></table></div> : <p className="saved-empty">Aucun membre n’est enregistré pour cet établissement.</p>}
      {error && members.length > 0 && <p className="staff-api-error" role="alert">{error}</p>}
    </section>
    {showForm && <div className="modal-backdrop" onClick={() => !saving && setShowForm(false)}><form className="modal staff-create-form" onSubmit={submit} onClick={event => event.stopPropagation()}>
      <div className="modal-head"><div><span className="eyebrow">COMPTE PERSONNEL</span><h2>Ajouter un membre</h2></div><button type="button" className="close" aria-label="Fermer" disabled={saving} onClick={() => setShowForm(false)}>×</button></div>
      <div className="form-row"><label>Prénom<input name="prenom" required maxLength={50} autoFocus /></label><label>Nom<input name="nom" required maxLength={50} /></label></div>
      <label>Adresse email professionnelle<input name="email_professionnel" type="email" required maxLength={70} /></label>
      <label>Identifiant de connexion<input name="identifiant_connexion" required maxLength={30} autoComplete="username" /></label>
      <div className="form-row"><label>Fonction<select name="role_metier" value={selectedRole} onChange={event => setSelectedRole(event.target.value)} required>{establishmentRoles.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label>Date d’embauche<input name="date_embauche" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} /></label></div>
      {selectedRole === 'secretaire' && <p className="demo-hint">Accès réception : rendez-vous, disponibilités des médecins et dossiers administratifs des patients. Les données médicales, consultations, facturation et gestion du personnel restent masquées.</p>}
      <label>Mot de passe provisoire<input name="password" type="password" required minLength={8} autoComplete="new-password" /></label>
      {selectedRole === 'medecin' && <label className="staff-specialty">Spécialité médicale<input name="specialite" required maxLength={40} placeholder="Ex. Médecine générale" /></label>}
      {error && <p className="auth-error" role="alert">{error}</p>}
      <p className="demo-hint">Le compte sera rattaché automatiquement à cet établissement. Seul un administrateur de plateforme peut créer un autre administrateur.</p>
      <div className="modal-actions"><button type="button" className="btn-light" disabled={saving} onClick={() => setShowForm(false)}>Annuler</button><button className="btn-primary" disabled={saving}>{saving ? 'Création…' : 'Créer le compte'}</button></div>
    </form></div>}
  </>
}
