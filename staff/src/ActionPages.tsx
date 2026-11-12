import { useState, type FormEvent, type ReactNode } from 'react'
import './action-pages.css'

export type AppointmentRecord = {
  id: string; patient: string; doctor: string; date: string; time: string; reason: string
  status?: string; refusalMessage?: string
}

export type InvoiceRecord = {
  id: string; patient: string; dossier: string; date: string; description: string
  quantity: number; unitPrice: number; total: number; coverage: number; patientShare: number
}

export type ConsultationRecord = { id: string; patient: string; doctor: string; date: string; reason: string; diagnosis: string; treatment: string }
export type AdmissionRecord = { id: string; patient: string; service: string; bed: string; date: string; reason: string }
export type LabOrderRecord = { id: string; patient: string; exam: string; priority: string; date: string; notes: string }
export type DispenseRecord = { id: string; patient: string; medication: string; lot: string; quantity: number; stockBefore: number; stockAfter: number; pharmacist: string; date: string; prescriptionCode?: string }
export type MedicationLot = { id: string; medication: string; stock: number; unit: string }

export const initialMedicationLots: MedicationLot[] = [
  { id: 'LOT-2026-A', medication: 'Amoxicilline + acide clavulanique 1 g', stock: 12, unit: 'comprimés' },
  { id: 'LOT-2026-B', medication: 'Amoxicilline + acide clavulanique 1 g', stock: 35, unit: 'comprimés' },
  { id: 'LOT-PAR-90', medication: 'Paracétamol 500 mg IV · flacon 100 ml', stock: 48, unit: 'flacons' },
  { id: 'LOT-CPX-992', medication: 'Ciprofloxacine 500 mg', stock: 48, unit: 'boîtes' },
]

const today = new Date().toISOString().slice(0, 10)

export function AppointmentPage({ patients, doctors, currentUserId, onBack, onSave }: { patients: { id: string; name: string }[]; doctors: { id: string; name: string; specialty: string }[]; currentUserId: string; onBack: () => void; onSave: (value: AppointmentRecord & { patientId: string; doctorId: string }) => Promise<AppointmentRecord> }) {
  const [saved, setSaved] = useState<AppointmentRecord | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const patient = patients.find(item => item.id === String(data.get('patient')))
    const doctor = doctors.find(item => item.id === String(data.get('doctor')))
    if (!patient || !doctor) { setError('Choisissez un patient et un medecin de MediHub.'); return }
    const record = { id: '', patientId: patient.id, doctorId: doctor.id, patient: patient.name,
      doctor: `${doctor.name}${doctor.specialty ? ` - ${doctor.specialty}` : ''}`,
      date: String(data.get('date')), time: String(data.get('time')), reason: String(data.get('reason')).trim() }
    setSaving(true); setError('')
    try { setSaved(await onSave(record)) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Le rendez-vous n a pas pu etre enregistre.') }
    finally { setSaving(false) }
  }

  if (saved) return <ActionPage title="Rendez-vous planifie" eyebrow="CONFIRMATION" onBack={onBack}>
    <div className="action-success"><span className="success-mark">OK</span><h2>Le rendez-vous est enregistre dans MediHub.</h2><p>Reference : <b>{saved.id}</b></p>
      <dl className="action-summary"><div><dt>Patient</dt><dd>{saved.patient}</dd></div><div><dt>Praticien</dt><dd>{saved.doctor}</dd></div><div><dt>Date & heure</dt><dd>{saved.date} a {saved.time}</dd></div><div><dt>Motif</dt><dd>{saved.reason}</dd></div></dl>
      <button className="btn-primary" onClick={onBack}>Voir le registre des rendez-vous</button></div>
  </ActionPage>

  return <ActionPage title="Planifier un rendez-vous" eyebrow="NOUVEAU RENDEZ-VOUS" onBack={onBack} intro="Le rendez-vous sera enregistre dans MediHub et visible dans l'agenda de l'etablissement.">
    <form className="action-form" onSubmit={submit}>
      <label>Patient<select name="patient" defaultValue="" required><option value="" disabled>Choisir un patient</option>{patients.map(item => <option key={item.id} value={item.id}>{item.name} - {item.id}</option>)}</select></label>
      <label>Praticien<select name="doctor" defaultValue={doctors.some(item => item.id === currentUserId) ? currentUserId : ''} required><option value="" disabled>Choisir un medecin</option>{doctors.map(item => <option key={item.id} value={item.id}>{item.name}{item.specialty ? ` - ${item.specialty}` : ''}</option>)}</select></label>
      <label>Date<input name="date" type="date" min={today} defaultValue={today} required /></label>
      <label>Heure<select name="time" defaultValue="09:00" required>{['08:30','09:00','09:30','10:00','10:30','11:00','14:00','14:30','15:00','15:30'].map(time => <option key={time}>{time}</option>)}</select></label>
      <label className="action-wide">Motif de consultation<textarea name="reason" rows={3} placeholder="Decrivez le motif" required maxLength={200} /></label>
      {error && <p className="auth-error" role="alert">{error}</p>}
      {!patients.length && <p className="auth-error" role="status">Aucun patient nest associe a cet etablissement. Ajoutez d abord son dossier.</p>}
      {!doctors.length && <p className="auth-error" role="status">Aucun medecin nest enregistre dans cet etablissement.</p>}
      <div className="action-form-footer"><button type="button" className="btn-light" onClick={onBack}>Annuler</button><button className="btn-primary" disabled={saving || !patients.length || !doctors.length}>{saving ? 'Enregistrement...' : 'Enregistrer le rendez-vous'} <span>-&gt;</span></button></div>
    </form>
  </ActionPage>
}

export function InvoicePage({ patients, onBack, onSave }: { patients: { name: string; id: string }[]; onBack: () => void; onSave: (value: InvoiceRecord) => void }) {
  const [saved, setSaved] = useState<InvoiceRecord | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [unitPrice, setUnitPrice] = useState(0)
  const [coverage, setCoverage] = useState(80)
  const total = quantity * unitPrice
  const patientShare = Math.round(total * (100 - coverage) / 100)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const patient = patients.find(p => p.id === data.get('patient'))
    if (!patient) return
    const record: InvoiceRecord = {
      id: `FAC-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`,
      patient: patient.name, dossier: patient.id, date: today,
      description: String(data.get('description')).trim(), quantity, unitPrice,
      total, coverage, patientShare,
    }
    onSave(record)
    setSaved(record)
  }

  if (saved) return <ActionPage title="Facture générée" eyebrow="DOCUMENT DE FACTURATION" onBack={onBack}>
    <div className="invoice-paper"><div className="invoice-paper-head"><div><span className="eyebrow">MEDIHUB · HÔPITAL KIRA</span><h2>Facture {saved.id}</h2></div><button className="btn-light no-print" onClick={() => window.print()}>Imprimer</button></div>
      <dl className="action-summary"><div><dt>Patient</dt><dd>{saved.patient}</dd></div><div><dt>Dossier</dt><dd>{saved.dossier}</dd></div><div><dt>Date d’émission</dt><dd>{saved.date}</dd></div></dl>
      <table className="invoice-table"><thead><tr><th>Acte / prestation</th><th>Qté</th><th>Prix unitaire</th><th>Total</th></tr></thead><tbody><tr><td>{saved.description}</td><td>{saved.quantity}</td><td>{saved.unitPrice.toLocaleString('fr-FR')} BIF</td><td>{saved.total.toLocaleString('fr-FR')} BIF</td></tr></tbody></table>
      <div className="invoice-totals"><p>Total des soins <b>{saved.total.toLocaleString('fr-FR')} BIF</b></p><p>Prise en charge ({saved.coverage} %) <b>{(saved.total - saved.patientShare).toLocaleString('fr-FR')} BIF</b></p><p className="invoice-due">Part patient <b>{saved.patientShare.toLocaleString('fr-FR')} BIF</b></p></div>
      <p className="invoice-demo-note">Facture de démonstration enregistrée localement. Aucun paiement n’a été effectué.</p>
      <button className="btn-primary no-print" onClick={onBack}>Retour à la facturation</button>
    </div>
  </ActionPage>

  return <ActionPage title="Générer une facture" eyebrow="NOUVELLE FACTURE" onBack={onBack} intro="Choisissez un dossier, détaillez la prestation et vérifiez la part patient avant de générer la facture.">
    <form className="action-form" onSubmit={submit}>
      <label>Patient<select name="patient" defaultValue="" required><option value="" disabled>Sélectionner un dossier patient</option>{patients.map(patient => <option key={patient.id} value={patient.id}>{patient.name} · {patient.id}</option>)}</select></label>
      <label>Date<input type="date" value={today} readOnly /></label>
      <label className="action-wide">Acte ou prestation<input name="description" placeholder="Ex. Consultation de médecine générale" required /></label>
      <label>Quantité<input type="number" min="1" value={quantity} onChange={e => setQuantity(Math.max(1, Number(e.target.value)))} required /></label>
      <label>Prix unitaire (BIF)<input type="number" min="0" step="100" value={unitPrice || ''} onChange={e => setUnitPrice(Number(e.target.value))} placeholder="Ex. 25000" required /></label>
      <label>Prise en charge<select value={coverage} onChange={e => setCoverage(Number(e.target.value))}><option value="0">0 % · Aucun assureur</option><option value="50">50 %</option><option value="80">80 % · Mutuelle</option><option value="100">100 %</option></select></label>
      <div className="invoice-preview action-wide"><span>Total : <b>{total.toLocaleString('fr-FR')} BIF</b></span><span>Part patient : <b>{patientShare.toLocaleString('fr-FR')} BIF</b></span></div>
      <div className="action-form-footer"><button type="button" className="btn-light" onClick={onBack}>Annuler</button><button className="btn-primary">Générer la facture <span>→</span></button></div>
    </form>
  </ActionPage>
}

export function ConsultationPage({ patients, initialPatientId, onBack, onSave }: { patients: { name: string; id: string }[]; initialPatientId?: string; onBack: () => void; onSave: (value: ConsultationRecord) => void }) {
  const [saved, setSaved] = useState<ConsultationRecord | null>(null)
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget)
    const patient = patients.find(p => p.id === data.get('patient')); if (!patient) return
    const record: ConsultationRecord = { id: `CONS-${Date.now()}`, patient: `${patient.name} · ${patient.id}`, doctor: String(data.get('doctor')), date: String(data.get('date')), reason: String(data.get('reason')).trim(), diagnosis: String(data.get('diagnosis')).trim(), treatment: String(data.get('treatment')).trim() }
    onSave(record); setSaved(record)
  }
  if (saved) return <ActionPage title="Consultation ouverte" eyebrow="DOSSIER CLINIQUE" onBack={onBack}><SuccessRecord title="La consultation est enregistrée." id={saved.id} details={[['Patient', saved.patient], ['Praticien', saved.doctor], ['Motif', saved.reason], ['Diagnostic', saved.diagnosis]]} onBack={onBack} backLabel="Retour aux consultations" /></ActionPage>
  return <ActionPage title="Ouvrir une consultation" eyebrow="NOUVELLE CONSULTATION" onBack={onBack} intro="Créez un épisode de consultation et consignez les informations cliniques initiales."><form className="action-form" onSubmit={submit}>
    <PatientSelect patients={patients} defaultValue={initialPatientId} />
    <label>Praticien<select name="doctor" required defaultValue=""><option value="" disabled>Choisir un praticien</option><option>Dr. Aline Manirakiza</option><option>Dr. Jean Nkurunziza</option><option>Dr. Chantal Munezero</option></select></label>
    <label>Date<input type="date" name="date" defaultValue={today} required /></label>
    <label>Motif<input name="reason" placeholder="Symptômes ou motif de visite" required /></label>
    <label className="action-wide">Diagnostic initial<textarea name="diagnosis" rows={3} placeholder="Constats cliniques" required /></label>
    <label className="action-wide">Conduite à tenir<textarea name="treatment" rows={3} placeholder="Examens, conseils ou traitement proposé" required /></label>
    <FormActions onBack={onBack} submit="Enregistrer la consultation" />
  </form></ActionPage>
}

export function AdmissionPage({ patients, onBack, onSave }: { patients: { name: string; id: string }[]; onBack: () => void; onSave: (value: AdmissionRecord) => void }) {
  const [saved, setSaved] = useState<AdmissionRecord | null>(null)
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget)
    const patient = patients.find(p => p.id === data.get('patient')); if (!patient) return
    const record: AdmissionRecord = { id: `ADM-${Date.now()}`, patient: `${patient.name} · ${patient.id}`, service: String(data.get('service')), bed: String(data.get('bed')).trim(), date: String(data.get('date')), reason: String(data.get('reason')).trim() }
    onSave(record); setSaved(record)
  }
  if (saved) return <ActionPage title="Admission enregistrée" eyebrow="HOSPITALISATION" onBack={onBack}><SuccessRecord title="Le séjour est ajouté au registre." id={saved.id} details={[['Patient', saved.patient], ['Service', saved.service], ['Lit attribué', saved.bed], ['Date d’admission', saved.date]]} onBack={onBack} backLabel="Voir les admissions" /></ActionPage>
  return <ActionPage title="Nouvelle admission" eyebrow="ADMISSION HOSPITALIÈRE" onBack={onBack} intro="Enregistrez l’admission et attribuez un lit au patient."><form className="action-form" onSubmit={submit}>
    <PatientSelect patients={patients} />
    <label>Date d’admission<input name="date" type="date" defaultValue={today} required /></label>
    <label>Service<select name="service" required defaultValue=""><option value="" disabled>Choisir un service</option><option>Médecine interne</option><option>Pédiatrie & Néonatologie</option><option>Maternité & Obstétrique</option><option>Chirurgie générale</option></select></label>
    <label>Numéro de lit<input name="bed" placeholder="Ex. MI-04" required /></label>
    <label className="action-wide">Motif d’admission<textarea name="reason" rows={3} placeholder="Indication et informations utiles à l’admission" required /></label>
    <FormActions onBack={onBack} submit="Enregistrer l’admission" />
  </form></ActionPage>
}

export function LabOrderPage({ patients, onBack, onSave }: { patients: { name: string; id: string }[]; onBack: () => void; onSave: (value: LabOrderRecord) => void }) {
  const [saved, setSaved] = useState<LabOrderRecord | null>(null)
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget)
    const patient = patients.find(p => p.id === data.get('patient')); if (!patient) return
    const record: LabOrderRecord = { id: `LAB-${Date.now()}`, patient: `${patient.name} · ${patient.id}`, exam: String(data.get('exam')), priority: String(data.get('priority')), date: String(data.get('date')), notes: String(data.get('notes')).trim() }
    onSave(record); setSaved(record)
  }
  if (saved) return <ActionPage title="Prescription créée" eyebrow="ORDONNANCE DE LABORATOIRE" onBack={onBack}><SuccessRecord title="L’examen a été ajouté à la file du laboratoire." id={saved.id} details={[['Patient', saved.patient], ['Examen', saved.exam], ['Priorité', saved.priority], ['Date', saved.date]]} onBack={onBack} backLabel="Voir les prescriptions" /></ActionPage>
  return <ActionPage title="Prescrire un examen" eyebrow="NOUVELLE PRESCRIPTION" onBack={onBack} intro="Choisissez le patient et l’examen à transmettre au laboratoire."><form className="action-form" onSubmit={submit}>
    <PatientSelect patients={patients} />
    <label>Date de prescription<input name="date" type="date" defaultValue={today} required /></label>
    <label>Examen<select name="exam" required defaultValue=""><option value="" disabled>Choisir un examen</option><option>Hémogramme complet (NFS)</option><option>Glycémie à jeun</option><option>Goutte épaisse / recherche du paludisme</option><option>Créatinine sanguine</option><option>Analyse d’urine (ECBU)</option><option>Autre examen</option></select></label>
    <label>Priorité<select name="priority"><option>Normale</option><option>Urgente</option><option>Immédiate</option></select></label>
    <label className="action-wide">Renseignements cliniques<textarea name="notes" rows={3} placeholder="Contexte clinique ou consignes au laboratoire" /></label>
    <FormActions onBack={onBack} submit="Transmettre au laboratoire" />
  </form></ActionPage>
}

export function DispensePage({ patients, lots, onBack, onSave }: { patients: { name: string; id: string }[]; lots: MedicationLot[]; onBack: () => void; onSave: (value: DispenseRecord, nextLots: MedicationLot[]) => void }) {
  const [saved, setSaved] = useState<DispenseRecord | null>(null)
  const [lotId, setLotId] = useState(lots.find(lot => lot.stock > 0)?.id || '')
  const [quantity, setQuantity] = useState(1)
  const lot = lots.find(item => item.id === lotId)
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget)
    const patient = patients.find(p => p.id === data.get('patient'))
    if (!patient || !lot || quantity < 1 || quantity > lot.stock) return
    const nextLots = lots.map(item => item.id === lot.id ? { ...item, stock: item.stock - quantity } : item)
    const record: DispenseRecord = { id: `DEL-${Date.now()}`, patient: `${patient.name} · ${patient.id}`, medication: lot.medication, lot: lot.id, quantity, stockBefore: lot.stock, stockAfter: lot.stock - quantity, pharmacist: String(data.get('pharmacist')).trim(), date: today }
    onSave(record, nextLots); setSaved(record)
  }
  if (saved) return <ActionPage title="Délivrance validée" eyebrow="STOCK MIS À JOUR" onBack={onBack}><SuccessRecord title="La délivrance est enregistrée et le lot décrémenté." id={saved.id} details={[['Patient', saved.patient], ['Médicament', saved.medication], ['Lot', saved.lot], ['Quantité délivrée', `${saved.quantity} · stock restant : ${saved.stockAfter}`], ['Pharmacien', saved.pharmacist]]} onBack={onBack} backLabel="Retour à la pharmacie" /></ActionPage>
  return <ActionPage title="Valider la délivrance" eyebrow="PHARMACIE · SORTIE DE STOCK" onBack={onBack} intro="Confirmez le patient, le lot et la quantité. Le stock local sera décrémenté après validation."><form className="action-form" onSubmit={submit}>
    <PatientSelect patients={patients} />
    <label>Date de délivrance<input type="date" value={today} readOnly /></label>
    <label className="action-wide">Médicament et lot<select value={lotId} onChange={event => { setLotId(event.target.value); setQuantity(1) }} required>{lots.map(item => <option key={item.id} value={item.id} disabled={item.stock === 0}>{item.medication} · {item.id} · stock {item.stock} {item.unit}</option>)}</select></label>
    <label>Quantité à délivrer<input type="number" min="1" max={lot?.stock || 1} value={quantity} onChange={event => setQuantity(Math.max(1, Number(event.target.value)))} required /></label>
    <label>Pharmacien responsable<input name="pharmacist" placeholder="Nom du pharmacien" required /></label>
    <div className="invoice-preview action-wide"><span>Stock actuel : <b>{lot?.stock ?? 0} {lot?.unit}</b></span><span>Après délivrance : <b>{Math.max(0, (lot?.stock ?? 0) - quantity)} {lot?.unit}</b></span></div>
    <p className="action-wide stock-warning">La validation enregistre la sortie dans ce navigateur. Le système de production devra confirmer le stock au backend.</p>
    <FormActions onBack={onBack} submit="Valider et décrémenter le lot" />
  </form></ActionPage>
}

export function ExternalDispensePage({ lots, onBack, onSave }: { lots: MedicationLot[]; onBack: () => void; onSave: (value: DispenseRecord, nextLots: MedicationLot[]) => void }) {
  const [saved, setSaved] = useState<DispenseRecord | null>(null)
  const [lotId, setLotId] = useState(lots.find(item => item.stock > 0)?.id || '')
  const [quantity, setQuantity] = useState(1)
  const lot = lots.find(item => item.id === lotId)
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget)
    if (!lot || quantity < 1 || quantity > lot.stock) return
    const nextLots = lots.map(item => item.id === lot.id ? { ...item, stock: item.stock - quantity } : item)
    const record: DispenseRecord = { id: `DEL-${Date.now()}`, patient: `Référence patient ${String(data.get('patientReference')).trim()}`, medication: lot.medication, lot: lot.id, quantity, stockBefore: lot.stock, stockAfter: lot.stock - quantity, pharmacist: String(data.get('pharmacist')).trim(), date: today, prescriptionCode: String(data.get('prescription')).trim() }
    onSave(record, nextLots); setSaved(record)
  }
  if (saved) return <ActionPage title="Délivrance partenaire enregistrée" eyebrow="PHARMACIE INDÉPENDANTE" onBack={onBack}><SuccessRecord title="Le lot de votre pharmacie a été décrémenté." id={saved.id} details={[['Référence patient', saved.patient], ['Médicament', saved.medication], ['Lot', saved.lot], ['Stock restant', `${saved.stockAfter} · après délivrance de ${saved.quantity}`], ['Pharmacien', saved.pharmacist]]} onBack={onBack} backLabel="Retour à ma pharmacie" /></ActionPage>
  return <ActionPage title="Valider une délivrance partenaire" eyebrow="PHARMACIE INDÉPENDANTE" onBack={onBack} intro="Saisissez la référence présente sur l’ordonnance et décrémentez uniquement le stock de votre pharmacie."><form className="action-form" onSubmit={submit}>
    <label>Code de prescription partenaire<input name="prescription" placeholder="Ex. ORD-HK-2026-0142" required /></label>
    <label>Référence patient<input name="patientReference" placeholder="Identifiant indiqué sur l’ordonnance" required /></label>
    <label className="action-wide">Médicament et lot<select value={lotId} onChange={event => { setLotId(event.target.value); setQuantity(1) }} required>{lots.map(item => <option key={item.id} value={item.id} disabled={item.stock === 0}>{item.medication} · {item.id} · stock {item.stock} {item.unit}</option>)}</select></label>
    <label>Quantité délivrée<input type="number" min="1" max={lot?.stock || 1} value={quantity} onChange={event => setQuantity(Math.max(1, Number(event.target.value)))} required /></label>
    <label>Pharmacien responsable<input name="pharmacist" placeholder="Nom du pharmacien" required /></label>
    <div className="invoice-preview action-wide"><span>Structure : <b>Pharmacie indépendante</b></span><span>Stock après validation : <b>{Math.max(0, (lot?.stock ?? 0) - quantity)} {lot?.unit}</b></span></div>
    <p className="action-wide stock-warning">Le code de prescription est saisi à titre de démonstration et n’est pas vérifié par un hôpital. La vérification et l’échange sécurisé des prescriptions nécessiteront le backend.</p>
    <FormActions onBack={onBack} submit="Confirmer et décrémenter le lot" />
  </form></ActionPage>
}

function PatientSelect({ patients, defaultValue }: { patients: { name: string; id: string }[]; defaultValue?: string }) {
  return <label>Patient<select name="patient" defaultValue={defaultValue || ''} required><option value="" disabled>Sélectionner un dossier patient</option>{patients.map(patient => <option key={patient.id} value={patient.id}>{patient.name} · {patient.id}</option>)}</select></label>
}

function FormActions({ onBack, submit }: { onBack: () => void; submit: string }) {
  return <div className="action-form-footer"><button type="button" className="btn-light" onClick={onBack}>Annuler</button><button className="btn-primary">{submit} <span>→</span></button></div>
}

function SuccessRecord({ title, id, details, onBack, backLabel }: { title: string; id: string; details: [string, string][]; onBack: () => void; backLabel: string }) {
  return <div className="action-success"><span className="success-mark">✓</span><h2>{title}</h2><p>Référence : <b>{id}</b></p><dl className="action-summary">{details.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><button className="btn-primary" onClick={onBack}>{backLabel}</button></div>
}

function ActionPage({ title, eyebrow, intro, onBack, children }: { title: string; eyebrow: string; intro?: string; onBack: () => void; children: ReactNode }) {
  return <div className="action-page"><div className="page-heading"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1>{intro && <p>{intro}</p>}</div><button className="btn-light" onClick={onBack}>← Retour</button></div><section className="panel action-panel">{children}</section></div>
}
