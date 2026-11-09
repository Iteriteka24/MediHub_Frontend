"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import "./portal.css";
import "./reference-overrides.css";
import {
  bookHospitalAppointment, checkHospitalAppointmentAvailability, getHospitalDoctors, getHospitals,
  getPatientDocuments, getPatientDossiers, getPatientProfile, patientAccountLogin, patientAccountSignup,
  patientApi, patientDocument, sharePatientHistory, verifyPatientAccountCode,
  type AccountCodeResponse, type AccountSession, type BookedAppointment,
  type Doctor, type Dossier, type Hospital, type PatientDocument, type PatientProfile, type SignupPayload, patientApiBase,
} from "./api";

type AuthStep = "login" | "signup" | "verify";
type View = "home" | "booking" | "sharing" | "profile" | "confirmed";

function message(error: unknown) { return error instanceof Error ? error.message : "Le serveur MediHub ne répond pas."; }
function today() { return new Date().toLocaleDateString("en-CA"); }

export default function Home() {
  const [authStep, setAuthStep] = useState<AuthStep>("login");
  const [view, setView] = useState<View>("home");
  const [account, setAccount] = useState<AccountSession["compte_patient"]>();
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [dossiers, setDossiers] = useState<Dossier[]>([]);
  const [selectedHospital, setSelectedHospital] = useState("");
  const [profileDossier, setProfileDossier] = useState("");
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [documents, setDocuments] = useState<PatientDocument[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [doctorId, setDoctorId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [booking, setBooking] = useState<BookedAppointment | null>(null);
  const [codeChallenge, setCodeChallenge] = useState<AccountCodeResponse | null>(null);
  const [authIntent, setAuthIntent] = useState<"login" | "signup">("login");
  const [sourceHospital, setSourceHospital] = useState("");
  const [destinationHospital, setDestinationHospital] = useState("");
  const [sourceDocuments, setSourceDocuments] = useState<PatientDocument[]>([]);
  const [sourceProfile, setSourceProfile] = useState<PatientProfile | null>(null);
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const [consent, setConsent] = useState(false);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const activeDossier = useMemo(() => dossiers.find(item => item.id_hopital === profileDossier), [dossiers, profileDossier]);
  const currentHospital = useMemo(() => hospitals.find(item => item.id_etablissement === selectedHospital), [hospitals, selectedHospital]);

  const loadAccountData = useCallback(async () => {
    const [list, facilities] = await Promise.all([getPatientDossiers(), getHospitals()]);
    setDossiers(list);
    setHospitals(facilities);
    if (list.length) setProfileDossier(current => list.some(item => item.id_hopital === current) ? current : list[0].id_hopital);
    if (facilities.length) setSelectedHospital(current => facilities.some(item => item.id_etablissement === current) ? current : facilities[0].id_etablissement);
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([getHospitals(), patientApi<AccountSession>("/api/portail/session/")])
      .then(async ([facilities, session]) => {
        if (!active) return;
        setHospitals(facilities);
        if (session.authenticated && session.compte_patient) {
          setAccount(session.compte_patient);
          await loadAccountData();
        } else if (session.authenticated) {
          await patientApi<void>("/api/portail/session/", { method: "DELETE" }).catch(() => undefined);
        }
      })
      .catch(error => { if (active) setNotice(message(error)); });
    return () => { active = false; };
  }, [loadAccountData]);

  useEffect(() => {
    if (!account || !selectedHospital || view !== "booking") return;
    let active = true;
    getHospitalDoctors(selectedHospital).then(list => {
      if (!active) return;
      setDoctors(list);
      setDoctorId(current => list.some(item => item.matricule_personnel === current) ? current : list[0]?.matricule_personnel || "");
    }).catch(error => { if (active) setNotice(message(error)); });
    return () => { active = false; };
  }, [account, selectedHospital, view]);

  useEffect(() => {
    if (!account || !profileDossier || view !== "profile") return;
    let active = true;
    Promise.all([getPatientProfile(profileDossier), getPatientDocuments(profileDossier)])
      .then(([profileData, docs]) => { if (active) { setProfile(profileData); setDocuments(docs); } })
      .catch(error => { if (active) { setProfile(null); setDocuments([]); setNotice(message(error)); } });
    return () => { active = false; };
  }, [account, profileDossier, view]);

  useEffect(() => {
    if (!account || !sourceHospital || view !== "sharing") return;
    let active = true;
    Promise.all([getPatientDocuments(sourceHospital), getPatientProfile(sourceHospital)]).then(([docs, profileData]) => {
      if (active) {
        setSourceProfile(profileData);
        const shareable = docs.filter(item => item.type_document === "resultat_examen" || item.type_document === "prescription" || item.type_document === "facture");
        setSourceDocuments(shareable);
        setSelectedDocuments(current => current.filter(key => shareable.some(item => `${item.type_document}:${item.id_document}` === key)));
      }
    }).catch(error => { if (active) { setSourceDocuments([]); setSourceProfile(null); setNotice(message(error)); } });
    return () => { active = false; };
  }, [account, sourceHospital, view]);

  async function startAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setNotice("");
    const data = new FormData(event.currentTarget);
    try {
      let result: AccountCodeResponse;
      if (authStep === "signup") {
        const payload: SignupPayload = {
          identifiant_connexion: String(data.get("identifiant_connexion") || ""),
          nom: String(data.get("nom") || ""), prenom: String(data.get("prenom") || ""),
          date_naissance: String(data.get("date_naissance") || ""), sexe: String(data.get("sexe") || ""),
          numero_telephone: String(data.get("numero_telephone") || ""), password: String(data.get("password") || ""),
          allergies_declarees: String(data.get("allergies_declarees") || ""),
          antecedents_declares: String(data.get("antecedents_declares") || ""),
          groupe_sanguin_declare: String(data.get("groupe_sanguin_declare") || ""),
        };
        result = await patientAccountSignup(payload); setAuthIntent("signup");
      } else {
        result = await patientAccountLogin(String(data.get("identifiant_connexion") || ""), String(data.get("password") || ""));
        setAuthIntent("login");
      }
      setCodeChallenge(result); setAuthStep("verify");
      setNotice(result.code_simule ? `Code de démonstration : ${result.code_simule}` : result.detail);
    } catch (error) { setNotice(message(error)); }
    finally { setBusy(false); }
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setNotice("");
    const code = String(new FormData(event.currentTarget).get("code") || "").trim();
    try {
      const session = await verifyPatientAccountCode(codeChallenge?.id_code || "", code);
      if (!session.authenticated || !session.compte_patient) throw new Error("Le serveur n’a pas ouvert votre session patient.");
      setAccount(session.compte_patient); setAuthStep("login"); setCodeChallenge(null); setNotice("");
      await loadAccountData();
    } catch (error) { setNotice(message(error)); }
    finally { setBusy(false); }
  }

  async function logout() {
    setBusy(true);
    try {
      await patientApi<void>("/api/portail/session/", { method: "DELETE" });
      setAccount(undefined); setDossiers([]); setProfile(null); setDocuments([]); setView("home"); setNotice("");
    } catch (error) { setNotice(message(error)); }
    finally { setBusy(false); }
  }

  async function submitBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedHospital || !doctorId || !date || !time) return;
    setBusy(true); setNotice("");
    try {
      const request = { matricule_personnel: doctorId, date_rendez_vous: date, heure_rendez_vous: `${time}:00` };
      const available = await checkHospitalAppointmentAvailability(selectedHospital, request);
      if (!available.disponible) throw new Error(available.raison === "date passée" ? "Choisissez une date et une heure futures." : "Ce créneau n’est plus disponible. Choisissez une autre heure.");
      const result = await bookHospitalAppointment(selectedHospital, request);
      setBooking(result); setView("confirmed");
      if (result.dossier_cree) await loadAccountData();
    } catch (error) { setNotice(message(error)); }
    finally { setBusy(false); }
  }

  async function submitShare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setNotice("");
    if (!consent || !sourceHospital || !destinationHospital || !dossiers.some(item => item.id_hopital === destinationHospital)) return;
    setBusy(true);
    try {
      const documentsToShare = selectedDocuments.map(key => {
        const [type_document, id_document] = key.split(":");
        return { type_document: type_document as "resultat_examen" | "prescription" | "facture", id_document };
      });
      const result = await sharePatientHistory({ id_hopital_source: sourceHospital, id_hopital_destination: destinationHospital, consentement: true, documents: documentsToShare });
      setNotice(`Partage effectué. ${result.nombre_documents} document(s) transmis avec votre consentement.`);
      setConsent(false); setSelectedDocuments([]);
    } catch (error) { setNotice(message(error)); }
    finally { setBusy(false); }
  }

  async function openDocument(item: PatientDocument, download: boolean) {
    if (!profileDossier) return;
    try { await patientDocument(item, profileDossier, download); }
    catch (error) { setNotice(message(error)); }
  }

  if (!account) return <div className="portal-shell">
    <header className="portal-header"><a className="portal-brand" href="#"><span className="portal-brandmark">✚</span><span><b>MediHub</b><small>VOTRE ESPACE PATIENT</small></span></a><div className="portal-header-right"><span className="secure-label"><i/> Accès sécurisé</span><span className="language">FR</span></div></header>
    <main className="auth-layout"><section className="auth-art"><div className="art-orb orb-one"/><div className="art-orb orb-two"/><span className="art-label"><i/> ESPACE PATIENT SÉCURISÉ</span><div className="art-copy"><h1>Votre santé,<br/>vos dossiers,<br/><em>en toute sérénité.</em></h1><p>Un compte patient pour retrouver vos dossiers par hôpital, gérer vos rendez-vous et partager vos documents en gardant le contrôle.</p></div><div className="art-photo"><div className="photo-placeholder"><span>✚</span><b>PRENDRE SOIN DE VOUS</b><small>À chaque étape du parcours.</small></div></div><div className="art-foot"><span>Vos données restent confidentielles</span><span>Un accompagnement humain</span></div></section>
      <section className="auth-form-wrap"><div className="auth-card"><div className="auth-mobile-logo"><span className="portal-brandmark">✚</span><b>MediHub</b></div><span className="eyebrow">BIENVENUE DANS VOTRE ESPACE</span>
        <h2>{authStep === "verify" ? "Vérifiez votre numéro" : authStep === "signup" ? "Créer mon compte patient" : "Connexion patient"}</h2>
        <p className="auth-intro">{authStep === "verify" ? "Saisissez le code à six chiffres envoyé sur votre téléphone." : authStep === "signup" ? "Créez votre compte et confirmez votre numéro de téléphone." : "Connectez-vous pour retrouver vos dossiers et vos documents médicaux."}</p>
        {authStep === "verify" ? <form onSubmit={verifyCode}><label className="field-label" htmlFor="account-code">Code de vérification</label><input className="code-field" id="account-code" name="code" inputMode="numeric" maxLength={6} pattern="[0-9]{6}" placeholder="_ _ _ _ _ _" required/><small className="field-hint">Code valable {Math.ceil((codeChallenge?.expire_dans_secondes || 300) / 60)} minutes. {codeChallenge?.code_simule && <>Code de démonstration : <b>{codeChallenge.code_simule}</b></>}</small><button className="auth-submit" disabled={busy}>{busy ? "Vérification…" : "Confirmer le code"}<span>→</span></button><button type="button" className="link-button" onClick={() => { setAuthStep(authIntent); setNotice(""); }}>← Retour</button></form>
          : <form onSubmit={startAuth} className="patient-auth-form">
            {authStep === "signup" && <><label className="field-label">Prénom<input name="prenom" autoComplete="given-name" required maxLength={100}/></label><label className="field-label">Nom<input name="nom" autoComplete="family-name" required maxLength={100}/></label><label className="field-label">Date de naissance<input name="date_naissance" type="date" max={today()} required/></label><label className="field-label">Genre<select name="sexe" defaultValue="" required><option value="" disabled>Choisir</option><option value="F">Femme</option><option value="M">Homme</option></select></label><label className="field-label">Téléphone<input name="numero_telephone" type="tel" autoComplete="tel" placeholder="+257 …" required maxLength={20}/></label><label className="field-label">Groupe sanguin<select name="groupe_sanguin_declare" defaultValue=""><option value="">Non renseigné</option>{["A+","A-","B+","B-","AB+","AB-","O+","O-"].map(group => <option key={group}>{group}</option>)}</select></label><label className="field-label auth-wide">Allergies connues<textarea name="allergies_declarees" rows={2} maxLength={500} placeholder="Facultatif"/></label><label className="field-label auth-wide">Antécédents médicaux<textarea name="antecedents_declares" rows={2} maxLength={1000} placeholder="Facultatif"/></label></>}
            <label className="field-label">Identifiant de connexion<input name="identifiant_connexion" autoComplete="username" required maxLength={50}/></label><label className="field-label">Mot de passe<input name="password" type="password" autoComplete={authStep === "signup" ? "new-password" : "current-password"} required minLength={8}/></label>
            <button className="auth-submit auth-wide" disabled={busy}>{busy ? "Veuillez patienter…" : authStep === "signup" ? "Créer le compte et recevoir un code" : "Recevoir un code de connexion"}<span>→</span></button>
          </form>}
        {notice && <div className="portal-notice auth-notice" role="status">{notice}</div>}
        {authStep !== "verify" && <p className="auth-switch">{authStep === "login" ? "Pas encore de compte ?" : "Vous avez déjà un compte ?"} <button onClick={() => { setAuthStep(authStep === "login" ? "signup" : "login"); setNotice(""); }}>{authStep === "login" ? "Créer un compte" : "Se connecter"}</button></p>}
      </div></section></main>
  </div>;

  const selectedDoctor = doctors.find(item => item.matricule_personnel === doctorId);
  const shareableDocuments = sourceDocuments.filter(item => item.type_document !== "historique_partage");
  const destinationHasDossier = dossiers.some(item => item.id_hopital === destinationHospital);
  const toggleDocument = (item: PatientDocument) => {
    const key = `${item.type_document}:${item.id_document}`;
    setSelectedDocuments(current => current.includes(key) ? current.filter(value => value !== key) : [...current, key]);
  };

  return <div className="portal-shell">
    <header className="portal-header"><a className="portal-brand" href="#" onClick={event => { event.preventDefault(); setView("home"); }}><span className="portal-brandmark">✚</span><span><b>MediHub</b><small>VOTRE ESPACE PATIENT</small></span></a><div className="portal-header-right"><span className="secure-label"><i/> Compte sécurisé</span><span className="language">FR</span></div></header>
    <div className="patient-view"><aside className="patient-sidebar"><div className="patient-sidebrand"><span className="portal-brandmark">✚</span><span><b>MediHub</b><small>ESPACE PATIENT</small></span></div><div className="side-separator"/>
      <button className={`side-nav ${view === "home" || view === "confirmed" ? "selected" : ""}`} onClick={() => setView("home")}>▦ &nbsp; Tableau de bord</button><button className={`side-nav ${view === "booking" ? "selected" : ""}`} onClick={() => setView("booking")}>◷ &nbsp; Rendez-vous</button><button className={`side-nav ${view === "profile" ? "selected" : ""}`} onClick={() => setView("profile")}>♙ &nbsp; Dossiers médicaux</button><button className={`side-nav ${view === "sharing" ? "selected" : ""}`} onClick={() => { setSourceHospital(dossiers[0]?.id_hopital || ""); setView("sharing"); }}>↗ &nbsp; Partager mon historique</button>
      <div className="side-help"><div className="help-circle">?</div><b>Besoin d’aide ?</b><p>Notre équipe est là pour vous accompagner.</p><button onClick={() => setNotice("Contactez l’accueil de votre hôpital.")}>Contacter l’accueil →</button></div><div className="side-user"><div className="patient-avatar">{`${account.prenom?.[0] || "P"}${account.nom?.[0] || ""}`}</div><div><b>{account.prenom} {account.nom}</b><small>Compte patient</small></div><button aria-label="Déconnexion" title="Déconnexion" disabled={busy} onClick={logout}>↪</button></div>
    </aside><main className="patient-main"><header className="patient-top"><div className="breadcrumb">Mon espace <span>/</span> {view === "booking" ? "Rendez-vous" : view === "sharing" ? "Partage de l’historique" : view === "profile" ? "Dossiers médicaux" : view === "confirmed" ? "Confirmation" : "Tableau de bord"}</div><div className="patient-top-right">{currentHospital?.nom_etablissement || "MediHub"}<i/><button onClick={logout}>Déconnexion</button></div></header><div className="patient-content">
      {notice && <div className="portal-notice" role="status">{notice}<button onClick={() => setNotice("")} aria-label="Fermer">×</button></div>}
      {view === "booking" && <><div className="booking-heading"><div><span className="eyebrow">RENDEZ-VOUS MULTI-HÔPITAUX</span><h1>Choisissez votre consultation</h1><p>Un dossier patient sera créé automatiquement dans l’hôpital si vous n’en avez pas encore.</p></div><button className="back-button" onClick={() => setView("home")}>← Retour</button></div><form className="booking-layout" onSubmit={submitBooking}><section className="patient-panel booking-panel"><div className="booking-section"><span className="step-number">1</span><div className="booking-section-body"><h2>Choisir un hôpital</h2><select value={selectedHospital} onChange={event => setSelectedHospital(event.target.value)} required><option value="">Choisir un hôpital</option>{hospitals.map(item => <option key={item.id_etablissement} value={item.id_etablissement}>{item.nom_etablissement} — {item.adresse}</option>)}</select></div></div><div className="booking-section"><span className="step-number">2</span><div className="booking-section-body"><h2>Choisir un médecin</h2><div className="doctor-options">{doctors.map(item => <button type="button" key={item.matricule_personnel} className={`doctor-option ${doctorId === item.matricule_personnel ? "chosen" : ""}`} onClick={() => setDoctorId(item.matricule_personnel)}><span className="doctor-avatar green">{item.prenom[0]}{item.nom[0]}</span><span><b>Dr. {item.prenom} {item.nom}</b><small>{item.specialite}</small></span><i>{doctorId === item.matricule_personnel ? "✓" : ""}</i></button>)}</div>{selectedHospital && !doctors.length && <p>Aucun médecin actif trouvé dans cet hôpital.</p>}</div></div><div className="booking-section"><span className="step-number">3</span><div className="booking-section-body"><h2>Date et heure</h2><label className="field-label">Date<input type="date" value={date} onChange={event => setDate(event.target.value)} min={today()} required/></label><label className="field-label">Heure<input type="time" value={time} onChange={event => setTime(event.target.value)} required/></label></div></div></section><aside className="patient-panel booking-summary"><span className="eyebrow">RÉSERVATION</span><h2>Votre demande</h2><div className="summary-line"><span>Hôpital</span><b>{currentHospital?.nom_etablissement || "À sélectionner"}</b></div><div className="summary-line"><span>Médecin</span><b>{selectedDoctor ? `Dr. ${selectedDoctor.prenom} ${selectedDoctor.nom}` : "À sélectionner"}</b></div><div className="summary-line"><span>Création du dossier</span><b>Automatique si nécessaire</b></div><div className="summary-note"><span>ⓘ</span><p>La disponibilité sera vérifiée par le serveur avant l’enregistrement définitif.</p></div><button className="auth-submit" disabled={busy || !doctors.length}>{busy ? "Vérification…" : "Vérifier et réserver"}<span>→</span></button></aside></form></>}

      {view === "sharing" && <><div className="booking-heading"><div><span className="eyebrow">PARTAGE VOLONTAIRE</span><h1>Partager mon historique médical</h1><p>Choisissez le dossier source, l’hôpital destinataire et les documents que vous souhaitez transmettre.</p></div><button className="back-button" onClick={() => setView("home")}>← Retour</button></div><form className="patient-panel share-form" onSubmit={submitShare}><div className="share-grid"><label className="field-label">Hôpital source<select value={sourceHospital} onChange={event => setSourceHospital(event.target.value)} required><option value="">Choisir un dossier source</option>{dossiers.map(item => <option key={item.id_hopital} value={item.id_hopital}>{item.nom_hopital}</option>)}</select></label><label className="field-label">Hôpital destinataire<select value={destinationHospital} onChange={event => setDestinationHospital(event.target.value)} required><option value="">Choisir un hôpital</option>{hospitals.filter(item => item.id_etablissement !== sourceHospital).map(item => <option key={item.id_etablissement} value={item.id_etablissement}>{item.nom_etablissement}{dossiers.some(record => record.id_hopital === item.id_etablissement) ? " · dossier existant" : " · rendez-vous nécessaire"}</option>)}</select></label></div><h2>Documents à transmettre <span className="history-count">Facultatif · {selectedDocuments.length} sélectionné(s)</span></h2><p className="share-explain">Le résumé des allergies et antécédents sera transmis avec votre consentement. Vous pouvez ajouter jusqu’à 10 documents.</p><div className="share-document-list">{shareableDocuments.length ? shareableDocuments.map(item => <label className="share-document" key={`${item.type_document}-${item.id_document}`}><input type="checkbox" checked={selectedDocuments.includes(`${item.type_document}:${item.id_document}`)} disabled={!selectedDocuments.includes(`${item.type_document}:${item.id_document}`) && selectedDocuments.length >= 10} onChange={() => toggleDocument(item)}/><span><b>{item.titre}</b><small>{item.type_document.replaceAll("_", " ")} · {item.date || "Date non renseignée"}</small></span></label>) : <p className="portal-empty">Aucun résultat, prescription ou facture disponible dans ce dossier source.</p>}</div><div className="share-summary"><b>Résumé avant envoi</b><p><strong>{dossiers.find(item => item.id_hopital === sourceHospital)?.nom_hopital || "Hôpital source"}</strong> transmettra à <strong>{hospitals.find(item => item.id_etablissement === destinationHospital)?.nom_etablissement || "l’hôpital destinataire"}</strong> les allergies ({sourceProfile?.allergies || "non renseignées"}), les antécédents ({sourceProfile?.antecedents_medicaux || "non renseignés"}), le groupe sanguin ({sourceProfile?.groupe_sanguin || "non renseigné"}), les mesures du poids ({sourceProfile?.mesures_poids?.length ? sourceProfile.mesures_poids.map(item => `${item.poids_kg} kg le ${item.date_mesure}`).join(", ") : "aucune"}) et {selectedDocuments.length} document(s) sélectionné(s). Le backend inclut aussi les informations médicales déclarées lors de l’inscription.</p>{!destinationHasDossier && destinationHospital && <p className="share-destination-warning">Un dossier doit d’abord exister dans cet hôpital. Prenez-y rendez-vous; le dossier sera créé automatiquement, puis vous pourrez revenir partager l’historique.</p>}</div><label className="consent-box"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} required/><span>Je consens explicitement au partage du résumé médical et des documents sélectionnés avec l’hôpital destinataire.</span></label><button className="auth-submit share-submit" disabled={busy || !consent || !sourceHospital || !destinationHospital || !destinationHasDossier}>{busy ? "Envoi sécurisé…" : "Confirmer et partager"}<span>→</span></button></form></>}

      {view === "profile" && <><div className="booking-heading"><div><span className="eyebrow">MES DONNÉES DE SANTÉ</span><h1>Mes dossiers médicaux</h1><p>Consultez votre profil et les documents associés à chaque hôpital.</p></div></div><div className="patient-panel dossier-picker"><label className="field-label">Dossier hospitalier<select value={profileDossier} onChange={event => { setProfileDossier(event.target.value); setProfile(null); }}><option value="">Choisir un hôpital</option>{dossiers.map(item => <option key={item.id_hopital} value={item.id_hopital}>{item.nom_hopital}</option>)}</select></label>{!dossiers.length && <p className="portal-empty">Aucun dossier hospitalier n’est encore associé à votre compte. Prenez un rendez-vous pour en créer un.</p>}</div>{profile && activeDossier && <><div className="patient-panels profile-panels"><section className="patient-panel"><div className="patient-panel-head"><div><h2>Profil · {activeDossier.nom_hopital}</h2><p>{profile.prenom} {profile.nom} · Dossier hospitalier</p></div></div><div className="profile-facts"><div><small>GROUPE SANGUIN</small><b>{profile.groupe_sanguin || "Non renseigné"}</b></div><div><small>POIDS</small><b>{profile.mesures_poids.length ? `${profile.mesures_poids[profile.mesures_poids.length - 1].poids_kg} kg` : "Non renseigné"}</b></div><div><small>ALLERGIES</small><b>{profile.allergies || "Aucune donnée renseignée"}</b></div><div><small>ANTÉCÉDENTS</small><b>{profile.antecedents_medicaux || "Aucune donnée renseignée"}</b></div></div>{profile.mesures_poids.length > 1 && <p className="profile-history">Mesures du poids : {profile.mesures_poids.map(item => `${item.poids_kg} kg (${item.date_mesure})`).join(" · ")}</p>}</section><section className="patient-panel doctor-profile"><div className="patient-panel-head"><div><h2>Mon médecin référent</h2><p>Rattaché à ce dossier</p></div></div>{profile.medecin_referent ? <div className="doctor-profile-row">{profile.medecin_referent.photo_profil ? <img src={profile.medecin_referent.photo_profil.startsWith("http") ? profile.medecin_referent.photo_profil : `${patientApiBase}${profile.medecin_referent.photo_profil}`} alt=""/> : <span className="doctor-avatar green">{profile.medecin_referent.prenom[0]}{profile.medecin_referent.nom[0]}</span>}<div><b>Dr. {profile.medecin_referent.prenom} {profile.medecin_referent.nom}</b><small>{profile.medecin_referent.specialite}</small></div></div> : <p className="portal-empty">Aucun médecin référent n’est encore associé à ce dossier.</p>}</section></div><section className="patient-panel record-documents"><div className="patient-panel-head"><div><h2>Mes documents</h2><p>Factures, prescriptions, résultats et documents reçus</p></div><span className="history-count">{documents.length} document(s)</span></div>{documents.length ? documents.map(item => <div className="portal-document" key={`${item.type_document}-${item.id_document}`}><div className="history-icon">▣</div><div><b>{item.titre}</b><small>{item.date || "Date non renseignée"} · {item.type_document.replaceAll("_", " ")}</small></div><button onClick={() => openDocument(item, false)}>Consulter</button><button onClick={() => openDocument(item, true)}>Télécharger</button></div>) : <p className="portal-empty">Aucun document disponible dans ce dossier.</p>}</section><section className="patient-panel received-history"><div className="patient-panel-head"><div><h2>Historiques partagés reçus</h2><p>Informations transmises volontairement à cet hôpital</p></div></div>{profile.historiques_partages.length ? profile.historiques_partages.map(history => <article className="shared-history-card" key={history.id_historique_partage}><div className="share-history-meta"><b>Hôpital source : {hospitals.find(item => item.id_etablissement === history.id_etablissement_source)?.nom_etablissement || history.id_etablissement_source}</b><small>Consentement enregistré le {new Date(history.date_consentement).toLocaleDateString("fr-FR")}</small></div><p>Allergies : {history.resume_medical.allergies || "non renseignées"}<br/>Antécédents : {history.resume_medical.antecedents_medicaux || "non renseignés"}<br/>Groupe sanguin : {history.resume_medical.groupe_sanguin || "non renseigné"}</p>{history.resume_medical.mesures_poids?.map((measure, index) => <small className="shared-weight" key={`${measure.date_mesure}-${index}`}>Poids : {measure.poids_kg} kg · {measure.date_mesure}</small>)}{history.documents.map(doc => <div className="shared-doc-row" key={doc.id_document_partage}><span>{doc.titre}</span><small>{doc.type_document.replaceAll("_", " ")} · {doc.date_document || "Date non renseignée"}</small></div>)}</article>) : <p className="portal-empty">Aucun historique partagé n’a été reçu pour ce dossier.</p>}</section></>}</>}

      {view === "confirmed" && booking && <div className="confirmed-wrap"><div className="confirmed-card"><div className="confirmed-check">✓</div><span className="eyebrow">RENDEZ-VOUS ENREGISTRÉ</span><h1>Votre rendez-vous est confirmé</h1><p>{booking.dossier_cree ? "Un nouveau dossier patient a été créé dans cet hôpital." : "Votre dossier patient existant a été utilisé."}</p><div className="confirmed-details"><div><span>HÔPITAL</span><b>{currentHospital?.nom_etablissement}</b></div><div><span>MÉDECIN</span><b>Dr. {booking.rendez_vous.medecin.prenom} {booking.rendez_vous.medecin.nom}</b><small>{booking.rendez_vous.medecin.specialite}</small></div><div><span>DATE ET HEURE</span><b>{booking.rendez_vous.date_rendez_vous} · {booking.rendez_vous.heure_rendez_vous}</b><small>{booking.rendez_vous.statut_rendez_vous}</small></div></div><button className="auth-submit" onClick={() => setView("home")}>Retour à mon espace <span>→</span></button></div></div>}

      {view === "home" && <div className="dashboard-view"><div className="welcome-banner"><div className="welcome-content"><span className="eyebrow">VOTRE ESPACE PERSONNEL</span><h1>Bonjour {account.prenom}, <span>bienvenue dans votre espace.</span></h1><p>Retrouvez vos dossiers et vos documents de santé par hôpital.</p></div><div className="welcome-actions"><span className="welcome-check">● <span>Session sécurisée</span></span><button className="book-button" onClick={() => setView("booking")}>◷ &nbsp;Prendre rendez-vous</button></div></div><div className="patient-stats"><div className="patient-stat"><small>COMPTE PATIENT</small><b>{account.identifiant_connexion}</b></div><div className="patient-stat"><small>DOSSIERS HOSPITALIERS</small><b>{dossiers.length}</b></div><div className="patient-stat"><small>ÉTABLISSEMENTS</small><b>{hospitals.length}</b></div></div><div className="patient-panels"><section className="patient-panel visit-panel"><div className="patient-panel-head"><div><h2>Mes dossiers par hôpital</h2><p>Accès au profil et aux documents propres à chaque établissement</p></div><button className="inline-link" onClick={() => setView("profile")}>Voir les dossiers</button></div>{dossiers.length ? dossiers.map(dossier => <div className="dossier-row" key={dossier.id_patient}><div className="history-icon">▦</div><div><b>{dossier.nom_hopital}</b><small>{dossier.prenom} {dossier.nom} · Dossier patient</small></div><button onClick={() => { setProfileDossier(dossier.id_hopital); setView("profile"); }}>Ouvrir</button></div>) : <p className="portal-empty">Aucun dossier hospitalier pour l’instant. Réservez un rendez-vous et un dossier sera créé automatiquement.</p>}</section><section className="patient-panel"><div className="patient-panel-head"><div><h2>Mes prochaines étapes</h2><p>Gérez votre parcours de soins</p></div></div><div className="home-actions"><button onClick={() => setView("booking")}><b>Prendre rendez-vous</b><small>Choisir un hôpital, un médecin et un créneau</small></button><button onClick={() => { setSourceHospital(dossiers[0]?.id_hopital || ""); setView("sharing"); }} disabled={!dossiers.length}><b>Partager mon historique</b><small>Transmettre un résumé avec votre consentement</small></button><button onClick={() => setView("profile")} disabled={!dossiers.length}><b>Consulter mes documents</b><small>Résultats, prescriptions et factures</small></button></div></section></div>{booking && <section className="patient-panel recent-booking"><div className="patient-panel-head"><div><h2>Dernière réservation effectuée</h2><p>Confirmation de cette session</p></div></div><p>Dr. {booking.rendez_vous.medecin.prenom} {booking.rendez_vous.medecin.nom} · {booking.rendez_vous.date_rendez_vous} à {booking.rendez_vous.heure_rendez_vous}</p></section>}</div>}
    </div></main></div>
  </div>;
}
