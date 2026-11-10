/* La Prépa, espace participant (La French Tech Grand Paris)
   Version Webflow + Firebase. La configuration est lue dans window.PREPA_CONFIG (bloc collé dans Webflow). */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail, sendEmailVerification } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const CFG = window.PREPA_CONFIG || {};
const ADMINS = (CFG.admins || []).map(e => String(e).toLowerCase());
const ROOT = document.getElementById("prepa-app");
let fbAuth = null, fbDb = null, configError = "";
try {
  if (!CFG.firebase || !CFG.firebase.apiKey || String(CFG.firebase.apiKey).includes("COLLE")) throw new Error("config");
  const fbApp = initializeApp(CFG.firebase);
  fbAuth = getAuth(fbApp); fbDb = getFirestore(fbApp);
} catch (e) { configError = "La configuration Firebase est absente ou incomplète dans le bloc Webflow."; }

/* État de session */
let user = null, isAdmin = false, ready = false, pending = null, authMode = "login", authMsg = "", authErr = "";
let syncState = "ok", saveTimer = null;
const CDN="https://cdn.prod.website-files.com/";
const IMG={
  logo:CDN+"64a34e8457fd12c08b34c5da/6ac3b9ff1a8fa08cbac96f57_La_Pr%C3%A9pa_Logo.svg",
  cafe:CDN+"64a34e8457fd12c08b34c521/6ac3c12a788d7b2469fad93d_caf%C3%A9.svg",
  loupe:CDN+"64a34e8457fd12c08b34c521/6ac3c12ae05bbe2dd336f88f_loupe.svg",
  tel:CDN+"64a34e8457fd12c08b34c521/6ac3c12b05b0ba5721bf56fa_t%C3%A9l%C3%A9phone.svg",
  trophee:CDN+"64a34e8457fd12c08b34c521/6ac3c19b56094b66e94d3862_troph%C3%A9e.svg",
  ordi:CDN+"64a34e8457fd12c08b34c521/6ac3c12b82ca1612d3baa232_ordinateur.svg"
};
const STICKER_SEQ={S1:"cafe",S2:"loupe",S3:"tel",S4:"trophee"};
const PAGE_PROGRAMME="https://www.frenchtech-grandparis.com/ft-programs/la-prepa";
let team = null, teamErr = "", teamOpen = "", teamLoading = false;

const DEF=()=>({profil:{prenom:"",projet:""},carnet:{},presence:{},prep:{},res:{},compteurs:{appels:0,rdv:0},badges:[],demo:"",updatedAt:0});
let S=DEF();

/* ---------- Contenu du programme ---------- */
const DEBUT="2026-11-16", FIN="2026-12-15";
const SEQS=[
  {id:"S1",nom:"Immersion",dates:"16 au 19 novembre"},
  {id:"S2",nom:"Outillage",dates:"23 au 27 novembre"},
  {id:"S3",nom:"Développement",dates:"2 au 4 décembre"},
  {id:"S4",nom:"Sprint final",dates:"7 au 15 décembre"}
];
const ATELIERS=[
  {id:"a1",d:"2026-11-16",seq:"S1",page:"depart",axes:[],t:"Lancement : visions d’entrepreneurs, diagnostic et écosystème",fmt:"Présentiel, journée",avec:"L’équipe de La French Tech Grand Paris, Marie (Maison M) et Lucien (Leets)",phrase:"On lance la promo avec des parcours d’entrepreneurs, puis tu poses le diagnostic de ton projet.",prep:["Venir avec ton ordinateur"],repart:"Ta grille de diagnostic, tes 3 priorités, la boîte à outils et la carto de l’écosystème"},
  {id:"a2",d:"2026-11-17",seq:"S1",page:"pitch2",axes:[],t:"Posture entrepreneuriale des femmes avec Willa",fmt:"Distanciel",avec:"Willa",phrase:"Légitimité, prise de parole, biais rencontrés dans l’écosystème, et un premier pitch « qui je suis, pourquoi ce projet ».",prep:["Relire ta page de départ (ton projet en 3 mots, pourquoi tu te lances)"],repart:"Ton pitch « qui je suis, pourquoi ce projet » de 2 minutes"},
  {id:"a3",d:"2026-11-18",seq:"S1",page:"offre",axes:["probleme","marche","offre"],t:"Master class : construire son offre avec et pour le client réel",fmt:"Présentiel",avec:"L’Escalator et des startups qu’il accompagne",phrase:"Le process de construction d’une offre, de l’idée au product-market fit, en se confrontant vite au client réel.",prep:["Relire ta grille de diagnostic, surtout « problème et client cible » et « marché et concurrence »"],repart:"Ton problème reformulé, ta proposition de valeur et ton business model v1"},
  {id:"a4",d:"2026-11-19",seq:"S1",page:"chiffres",axes:["chiffres"],t:"Prévisionnel financier et outils de pilotage",fmt:"Présentiel, matinée",avec:"La Ruche",phrase:"Traduire ton projet en chiffres : compte de résultat prévisionnel, plan de trésorerie et plan de financement.",prep:["Reprendre ton business model v1 : qui paie, pour quoi, combien","Lister tes premières dépenses prévues","Venir avec un ordinateur équipé d’un tableur"],repart:"Ton prévisionnel, ton plan de trésorerie et ton plan de financement v1"},
  {id:"a5",d:"2026-11-23",seq:"S2",page:"ia",axes:["marche","probleme"],t:"L’IA au service de l’entrepreneur",fmt:"Distanciel, matinée",avec:"Melissa (La French Tech Grand Paris)",phrase:"Maquetter ton offre, cibler tes clients et comprendre ce que les agents IA peuvent faire pour toi.",prep:["Créer les comptes nécessaires (liste envoyée avant l’atelier)","Avoir sous la main ta proposition de valeur","Un ordinateur et une connexion stable"],repart:"Ta maquette, tes segments de clients, tes 10 premiers prospects et ta base d’outils IA"},
  {id:"a6",d:"2026-11-24",seq:"S2",page:"financement",axes:["financement","chiffres"],t:"Journée rencontres écosystème financier",fmt:"Présentiel, journée",avec:"Banque de France, Bpifrance, EPSA et Paris Initiative Entreprise",phrase:"Le matin, un jeu de piste sur l’éducation financière. L’après-midi, trois acteurs du financement.",prep:["Reprendre ton plan de financement v1 : de combien tu as besoin, et pour quoi","Noter tes questions et les hypothèses dont tu n’es pas sûr·e"],repart:"Ta carte des financements et ton plan de financement mis à jour"},
  {id:"a7",d:"2026-11-25",seq:"S2",page:"marque",axes:["marque"],t:"Communication et marque",fmt:"Présentiel, matinée",avec:"Kedge Entrepreneurship et Gabriella",phrase:"Ton positionnement de marque, ta prise de parole et tes premiers canaux, dont le SEO et le GEO.",prep:["Reprendre ta proposition de valeur et tes clients cibles","Noter 3 marques que tu admires, et pourquoi"],repart:"Ton message clé et ton plan de communication sur 3 mois"},
  {id:"a8",d:"2026-11-26",seq:"S2",page:"juridique",axes:["juridique"],t:"Juridique : propriété intellectuelle et pacte d’associés",fmt:"Présentiel, matinée",avec:"INPI et White & Case",phrase:"Protéger ce que tu crées, puis organiser la relation entre associés.",prep:["Lister ce que tu crées et qui a de la valeur : nom, logo, technologie, méthode, contenus","Noter ta situation : seul·e ou avec des associés, qui apporte quoi"],repart:"Ta carte PI et les points clés de ton pacte d’associés"},
  {id:"a9",d:"2026-11-27",seq:"S2",page:"deck",axes:[],t:"Pitcher son projet",fmt:"Présentiel, journée",avec:"Jeremy Navon (Pitch My Startup)",phrase:"Préparer, structurer et délivrer ton pitch, avec des passages devant le groupe et des retours personnalisés.",prep:["Reprendre ton pitch de 2 minutes et les retours reçus","Rassembler proposition de valeur, chiffres clés, besoins de financement et message clé"],repart:"Ton pitch structuré et ton pitch deck v1"},
  {id:"a10",d:"2026-12-02",seq:"S3",page:"acquisition",axes:["commercial"],t:"Acquisition client et hybridation grands groupes x startups",fmt:"Présentiel, journée",avec:"Village by CA (après-midi)",phrase:"Ta stratégie d’acquisition le matin, l’approche des grands comptes l’après-midi.",prep:["Reprendre tes clients cibles, ta liste de prospects et tes canaux","Noter les grands groupes qui pourraient être clients ou partenaires"],repart:"Ton plan d’acquisition et 3 grands comptes à approcher",alerte:"Pour le lendemain : finalise ta liste de 15 à 20 clients potentiels (structure, interlocuteur, coordonnées)."},
  {id:"a11",d:"2026-12-03",seq:"S3",page:"sales",axes:["commercial"],t:"Bootcamp sales : stratégies commerciales et cold call",fmt:"Présentiel, journée",avec:"Inskip",phrase:"Les stratégies et techniques de vente le matin, une vraie session de cold call sur ta liste l’après-midi.",prep:["Ta liste de 15 à 20 clients potentiels (obligatoire)","Ton plan d’acquisition et ton pitch","Ton téléphone chargé et ton ordinateur"],repart:"Ton script d’appel et tes premiers rendez-vous commerciaux",alerte:"Prérequis obligatoire : sans liste de 15 à 20 contacts, pas de cold call l’après-midi."},
  {id:"a12",d:"2026-12-04",seq:"S3",page:"admin",axes:["juridique"],t:"Matinée French Tech Central : les services publics du démarrage",fmt:"Présentiel, matinée",avec:"French Tech Central, URSSAF, DGFiP, APEC, CCI Paris Île-de-France, Radio France",phrase:"Rencontrer les services publics qui peuvent t’aider à démarrer.",prep:["Noter où tu en es : immatriculé·e ou non, statut envisagé, seul·e ou avec des associés","Lister tes questions administratives"],repart:"Ta check-list administrative et ton carnet de contacts"},
  {id:"a13",d:"2026-12-07",f:"2026-12-14",seq:"S4",page:"route",axes:[],t:"Semaine de travail individuel",fmt:"Distanciel, en autonomie",avec:"Office hours avec Iriantsoa et Melissa, sur réservation",phrase:"Une semaine pour compléter ton carnet, consolider ton projet et préparer le pitch final.",prep:["Relire tout ton carnet et revoir tes 3 priorités","Finaliser ton pitch et ton deck","Envoyer ton deck au plus tard le lundi 14 décembre"],repart:"Ton carnet complet, ton pitch et ton deck finalisés",alerte:"Deck à envoyer au plus tard le lundi 14 décembre à iriantsoa@frenchtech-grandparis.com et melissa@frenchtech-grandparis.com, objet « Deck Prépa : [nom de la startup] »."},
  {id:"a14",d:"2026-12-15",seq:"S4",page:"route",axes:[],t:"Jour J : pitch final devant le jury",fmt:"Présentiel, matinée",avec:"Un jury d’incubateurs, de financeurs et de partenaires",phrase:"5 minutes de pitch et 3 minutes de questions en salle. Les deux champions s’affrontent ensuite en 3 minutes.",prep:["Pitch répété et chronométré, 5 minutes maximum","Une version courte de 3 minutes, au cas où","Ta feuille de route à 3 mois"],repart:"Les retours du jury, de nouveaux contacts et ta feuille de route consolidée"}
];
const AXES=[
  {id:"probleme",nom:"Problème et client cible",theme:"offre",page:"offre"},
  {id:"marche",nom:"Marché et concurrence",theme:"marche",page:"ia"},
  {id:"offre",nom:"Offre et modèle économique",theme:"offre",page:"offre"},
  {id:"chiffres",nom:"Chiffres et prévisionnel",theme:"chiffres",page:"chiffres"},
  {id:"financement",nom:"Financement",theme:"financement",page:"financement"},
  {id:"juridique",nom:"Juridique et administratif",theme:"juridique",page:"juridique"},
  {id:"marque",nom:"Marque et communication",theme:"marque",page:"marque"},
  {id:"commercial",nom:"Commercial et prospection",theme:"commercial",page:"acquisition"}
];
const PAGES=[
  {id:"depart",atelier:"a1",titre:"Ma page de départ",intro:"Pose ton projet et ton diagnostic. C’est ce qui personnalise ton parcours et ta ressourcerie.",fields:[
    {id:"mots",type:"text",label:"Ton projet en 3 mots"},
    {id:"pourquoi",type:"area",label:"Pourquoi tu te lances"},
    {id:"diag",type:"diag",label:"Ta grille de diagnostic",help:"Note chaque axe de 1 (rien de posé) à 5 (solide). Tu pourras la mettre à jour pendant le mois."},
    {id:"prio",type:"list",n:3,label:"Tes 3 priorités du mois"}]},
  {id:"pitch2",atelier:"a2",titre:"Mon pitch « qui je suis, pourquoi ce projet »",fields:[
    {id:"pitch",type:"area",label:"Ton pitch de 2 minutes",help:"Écris-le comme tu le dirais à l’oral."},
    {id:"freins",type:"area",label:"Tes freins de légitimité, et un levier pour chacun"},
    {id:"retours",type:"area",label:"Les retours reçus"}]},
  {id:"offre",atelier:"a3",titre:"Mon offre",fields:[
    {id:"probleme",type:"area",label:"Le problème que tu résous, reformulé"},
    {id:"cible",type:"area",label:"Ton client cible"},
    {id:"pv",type:"area",label:"Ta proposition de valeur"},
    {id:"bm",type:"area",label:"Ton business model v1",help:"Qui paie, pour quoi, combien."},
    {id:"hypo",type:"list",n:3,label:"Les hypothèses à tester en priorité auprès de vrais clients"}]},
  {id:"chiffres",atelier:"a4",titre:"Mes chiffres",fields:[
    {id:"ca",type:"number",label:"Chiffre d’affaires visé en année 1 (€)"},
    {id:"charges",type:"number",label:"Charges prévues en année 1 (€)"},
    {id:"calc",type:"calc"},
    {id:"besoin",type:"number",label:"Ton besoin de financement de départ (€)"},
    {id:"depenses",type:"list",n:5,label:"Tes premières dépenses"},
    {id:"fichier",type:"url",label:"Lien vers ton prévisionnel",help:"Ton tableur avec compte de résultat, trésorerie et plan de financement."}]},
  {id:"ia",atelier:"a5",titre:"Mes outils IA et mes premiers prospects",fields:[
    {id:"maquette",type:"url",label:"Lien vers ta maquette"},
    {id:"segments",type:"area",label:"Tes segments de clients"},
    {id:"prospects",type:"list",n:10,label:"Tes 10 premiers prospects"},
    {id:"outils",type:"area",label:"Ta base d’outils IA"}]},
  {id:"financement",atelier:"a6",titre:"Ma carte des financements",fields:[
    {id:"dispo",type:"check",label:"Les financements adaptés à ton stade",opts:["Prêt d’honneur","Aide ou bourse Bpifrance","Prêt bancaire","Statut JEI","CIR ou CII","Love money","Business angels","Concours et prix"]},
    {id:"plan",type:"area",label:"Ton plan de financement mis à jour"},
    {id:"questions",type:"area",label:"Les questions qui te restent"}]},
  {id:"marque",atelier:"a7",titre:"Ma marque",fields:[
    {id:"message",type:"text",label:"Ton message clé"},
    {id:"admire",type:"list",n:3,label:"3 marques que tu admires, et pourquoi"},
    {id:"canaux",type:"check",label:"Tes 1 ou 2 canaux prioritaires",opts:["LinkedIn","Instagram","TikTok","Newsletter","SEO","GEO","Événements","Bouche-à-oreille"]},
    {id:"plan3",type:"area",label:"Ton plan de communication sur 3 mois"}]},
  {id:"juridique",atelier:"a8",titre:"Ma carte PI et mon pacte",fields:[
    {id:"valeur",type:"list",n:5,label:"Ce que tu crées et qui a de la valeur"},
    {id:"protect",type:"check",label:"Les protections qui te concernent",opts:["Marque","Brevet","Dessins et modèles","Droit d’auteur","Secret des affaires"]},
    {id:"situation",type:"area",label:"Ta situation : seul·e ou avec des associés, qui apporte quoi"},
    {id:"pacte",type:"area",label:"Les points clés de ton pacte d’associés"}]},
  {id:"deck",atelier:"a9",titre:"Mon pitch deck",fields:[
    {id:"cible",type:"text",label:"À qui tu parles, pour obtenir quoi"},
    {id:"accroche",type:"area",label:"Ton accroche"},
    {id:"trame",type:"list",n:8,label:"Ta trame, slide par slide"},
    {id:"lien",type:"url",label:"Lien vers ton pitch deck"}]},
  {id:"acquisition",atelier:"a10",titre:"Mon plan d’acquisition",fields:[
    {id:"canaux",type:"area",label:"Tes canaux d’acquisition prioritaires"},
    {id:"crm",type:"text",label:"Ton outil de suivi (CRM, tableur…)"},
    {id:"comptes",type:"list",n:3,label:"3 grands comptes à approcher"},
    {id:"nb",type:"number",label:"Nombre de contacts dans ta liste clients",help:"Objectif : 15 à 20 contacts avant le bootcamp sales du 3 décembre."}]},
  {id:"sales",atelier:"a11",titre:"Mon script d’appel",fields:[
    {id:"script",type:"area",label:"Ton script d’appel"},
    {id:"objections",type:"area",label:"Les objections entendues, et tes réponses"},
    {id:"compteurs",type:"counters",label:"Ton compteur de cold call"}]},
  {id:"admin",atelier:"a12",titre:"Ma check-list administrative",fields:[
    {id:"statut",type:"text",label:"Ton statut envisagé"},
    {id:"check",type:"check",label:"Ce qui est fait",opts:["Choisir mon statut juridique","Comprendre mes cotisations sociales","Vérifier les aides à la création","Choisir mon régime fiscal et de TVA","Créer mon espace professionnel des impôts","Préparer mon immatriculation"]},
    {id:"contacts",type:"list",n:6,label:"Ton carnet de contacts"}]},
  {id:"route",atelier:"a14",titre:"Ma feuille de route à 3 mois",fields:[
    {id:"m1",type:"area",label:"Mois 1"},
    {id:"m2",type:"area",label:"Mois 2"},
    {id:"m3",type:"area",label:"Mois 3"},
    {id:"jury",type:"area",label:"Les retours du jury"}]}
];
const THEMES={offre:"Offre",marche:"Marché",chiffres:"Chiffres",financement:"Financement",juridique:"Juridique et admin",marque:"Marque",commercial:"Commercial",outils:"IA et outils",reseau:"Réseaux"};
const RES=[
  {id:"r1",t:"Bpifrance Création",type:"Guide",th:"offre",url:"https://bpifrance-creation.fr",d:"Des fiches pratiques gratuites sur chaque étape de la création : étude de marché, statut, financement."},
  {id:"r2",t:"Value Proposition Canvas",type:"Méthode",th:"offre",url:"https://www.strategyzer.com",d:"Le canevas pour relier les besoins de ton client à ton offre."},
  {id:"r3",t:"Lean Canvas",type:"Méthode",th:"offre",url:"https://leanstack.com",d:"Ton modèle économique sur une page, pensé pour les projets en démarrage."},
  {id:"r4",t:"INSEE",type:"Données",th:"marche",url:"https://www.insee.fr",d:"Les statistiques officielles pour dimensionner ton marché."},
  {id:"r5",t:"Pappers",type:"Données",th:"marche",url:"https://www.pappers.fr",d:"Les infos légales et financières des entreprises, pratique pour étudier tes concurrents."},
  {id:"r6",t:"Google Trends",type:"Outil",th:"marche",url:"https://trends.google.fr",d:"Voir comment évolue l’intérêt pour un sujet ou un mot-clé."},
  {id:"r7",t:"Tally",type:"Outil",th:"marche",url:"https://tally.so",d:"Des formulaires gratuits pour tes questionnaires clients."},
  {id:"r8",t:"Mes questions d’argent",type:"Guide",th:"chiffres",url:"https://www.mesquestionsdargent.fr",d:"Le portail national d’éducation financière, piloté par la Banque de France."},
  {id:"r9",t:"Bpifrance",type:"Financement",th:"financement",url:"https://www.bpifrance.fr",d:"Aides, prêts et dispositifs pour financer l’innovation."},
  {id:"r10",t:"Initiative France",type:"Réseau",th:"financement",url:"https://www.initiative-france.fr",d:"Des prêts d’honneur sans intérêt et un parrainage pour créateurs."},
  {id:"r11",t:"Réseau Entreprendre",type:"Réseau",th:"financement",url:"https://www.reseau-entreprendre.org",d:"Des prêts d’honneur et un accompagnement par des chefs d’entreprise."},
  {id:"r12",t:"Aides-entreprises.fr",type:"Outil",th:"financement",url:"https://www.aides-entreprises.fr",d:"Un moteur de recherche des aides publiques aux entreprises."},
  {id:"r13",t:"INPI",type:"Guide",th:"juridique",url:"https://www.inpi.fr",d:"Protéger ta marque, ton brevet, tes dessins et modèles."},
  {id:"r14",t:"Guichet unique des formalités",type:"Démarche",th:"juridique",url:"https://formalites.entreprises.gouv.fr",d:"Le guichet en ligne pour créer et immatriculer ton entreprise."},
  {id:"r15",t:"Entreprendre Service Public",type:"Guide",th:"juridique",url:"https://entreprendre.service-public.fr",d:"Le site officiel des démarches et obligations des entreprises."},
  {id:"r16",t:"URSSAF",type:"Démarche",th:"juridique",url:"https://www.urssaf.fr",d:"Statut social, cotisations et aides à la création."},
  {id:"r17",t:"Impots.gouv professionnel",type:"Démarche",th:"juridique",url:"https://www.impots.gouv.fr/professionnel",d:"Ton espace pro, les régimes fiscaux et la TVA."},
  {id:"r18",t:"Canva",type:"Outil",th:"marque",url:"https://www.canva.com",d:"Créer ton logo, tes visuels et tes premières présentations."},
  {id:"r19",t:"HubSpot CRM",type:"Outil",th:"commercial",url:"https://www.hubspot.com/products/crm",d:"Un CRM gratuit pour suivre tes prospects et tes relances."},
  {id:"r20",t:"Notion",type:"Outil",th:"outils",url:"https://www.notion.so",d:"Organiser tes notes, ta to-do et ta base de prospects."},
  {id:"r21",t:"Claude",type:"IA",th:"outils",url:"https://claude.ai",d:"Un assistant IA pour rédiger, analyser et structurer ton projet."},
  {id:"r22",t:"Perplexity",type:"IA",th:"outils",url:"https://www.perplexity.ai",d:"Une recherche web sourcée, utile pour ta veille concurrentielle."},
  {id:"r23",t:"Figma",type:"Outil",th:"outils",url:"https://www.figma.com",d:"Maquetter ton app ou ta landing page."},
  {id:"r24",t:"Willa",type:"Réseau",th:"reseau",url:"https://www.willa.fr",d:"Le premier incubateur dédié aux femmes entrepreneures en France."},
  {id:"r25",t:"APEC",type:"Réseau",th:"reseau",url:"https://www.apec.fr",d:"Accompagnement des créateurs et recrutement des premiers collaborateurs."}
];
const LEVELS=[{nom:"Étincelle",min:0},{nom:"Impulsion",min:150},{nom:"Élan",min:350},{nom:"Envol",min:600},{nom:"Décollage",min:900}];
const BADGES=[
  {id:"pas",nom:"Premier pas",d:"Ton espace est créé",ini:"1",test:()=>!!S.profil.prenom},
  {id:"diag",nom:"Diagnostic posé",d:"Les 8 axes sont notés",ini:"D",test:()=>diagDone()},
  {id:"S1",nom:"Immersion bouclée",d:"Ateliers suivis et pages remplies",ini:"S1",test:()=>seqDone("S1")},
  {id:"S2",nom:"Outillage bouclé",d:"Ateliers suivis et pages remplies",ini:"S2",test:()=>seqDone("S2")},
  {id:"S3",nom:"Développement bouclé",d:"Ateliers suivis et pages remplies",ini:"S3",test:()=>seqDone("S3")},
  {id:"S4",nom:"Sprint final bouclé",d:"Feuille de route et pitch final",ini:"S4",test:()=>seqDone("S4")},
  {id:"curieux",nom:"Curieux·se",d:"5 ressources consultées",ini:"5",test:()=>Object.keys(S.res).length>=5},
  {id:"appel",nom:"Cold caller",d:"10 appels passés",ini:"10",test:()=>S.compteurs.appels>=10},
  {id:"rdv",nom:"Premier rendez-vous",d:"Un RDV décroché en prospection",ini:"RDV",test:()=>S.compteurs.rdv>=1},
  {id:"carnet",nom:"Carnet complet",d:"Toutes les pages remplies",ini:"C",test:()=>PAGES.every(p=>pagePct(p)===100)}
];


/* ---------- Outils ---------- */
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const iso=d=>{const z=n=>String(n).padStart(2,"0");return d.getFullYear()+"-"+z(d.getMonth()+1)+"-"+z(d.getDate());};
const today=()=>(isAdmin&&S.demo)?S.demo:iso(new Date());
const days=(a,b)=>Math.round((new Date(b+"T12:00:00")-new Date(a+"T12:00:00"))/864e5);
const MOIS=["janv.","févr.","mars","avr.","mai","juin","juil.","août","sept.","oct.","nov.","déc."];
const JOURS=["dim.","lun.","mar.","mer.","jeu.","ven.","sam."];
const dt=s=>{const d=new Date(s+"T12:00:00");return {j:JOURS[d.getDay()],n:d.getDate(),m:MOIS[d.getMonth()]};};
const fdate=a=>{const x=dt(a.d);if(a.f){const y=dt(a.f);return "du "+x.n+" au "+y.n+" "+y.m;}return x.j+" "+x.n+" "+x.m;};
const atelier=id=>ATELIERS.find(a=>a.id===id);
const page=id=>PAGES.find(p=>p.id===id);
function status(a){const t=today(),end=a.f||a.d; if(t>end) return "passe"; if(t>=a.d) return "jour"; return "avenir";}
const nextAtelier=()=>ATELIERS.find(a=>status(a)!=="passe");
function val(p,f){return (S.carnet[p]||{})[f];}
function setVal(p,f,v){S.carnet[p]=S.carnet[p]||{}; S.carnet[p][f]=v;}
function diagDone(){const v=val("depart","diag");return !!v&&AXES.every(a=>v[a.id]);}
function filled(p,f){
  const v=val(p.id,f.id);
  switch(f.type){
    case "calc": return null;
    case "diag": return diagDone();
    case "list": return Array.isArray(v)&&v.some(x=>x&&x.trim());
    case "check": return Array.isArray(v)&&v.length>0;
    case "counters": return S.compteurs.appels>0;
    case "number": return v!==undefined&&v!==null&&v!=="";
    default: return !!(v&&String(v).trim());
  }
}
function pagePct(p){const fs=p.fields.filter(f=>f.type!=="calc");const n=fs.filter(f=>filled(p,f)).length;return Math.round(n/fs.length*100);}
function seqDone(sid){
  const as=ATELIERS.filter(a=>a.seq===sid);
  return as.every(a=>S.presence[a.id]) && [...new Set(as.map(a=>a.page))].every(pid=>pagePct(page(pid))===100);
}
function points(){
  let p=0;
  PAGES.forEach(pg=>pg.fields.forEach(f=>{if(filled(pg,f)) p+=10;}));
  p+=Object.keys(S.presence).length*20;
  p+=Object.keys(S.prep).length*5;
  p+=Object.keys(S.res).length*5;
  p+=Math.min(S.compteurs.appels*2,40)+Math.min(S.compteurs.rdv*15,75);
  return p;
}
function level(pts){
  let i=0; LEVELS.forEach((l,k)=>{if(pts>=l.min) i=k;});
  const cur=LEVELS[i], nx=LEVELS[i+1];
  return {nom:cur.nom,next:nx,pct:nx?Math.round((pts-cur.min)/(nx.min-cur.min)*100):100};
}
function weakAxes(n){
  if(!diagDone()) return [];
  const v=val("depart","diag");
  return AXES.map((a,i)=>({...a,s:v[a.id],i})).sort((x,y)=>x.s-y.s||x.i-y.i).slice(0,n);
}
function position(){
  const t=today();
  if(t<DEBUT){const n=days(t,DEBUT);return {big:"J-"+n,small:n===1?"Demain, c’est le lancement de la Prépa.":"avant le lancement de la Prépa, le lundi 16 novembre."};}
  if(t>FIN) return {big:"Bravo",small:"La Prépa est terminée. Ta feuille de route prend le relais."};
  const n=days(DEBUT,t)+1; return {big:"Jour "+n,small:"sur les 30 jours de la Prépa."};
}
let toastT;
function toast(msg){const el=document.getElementById("pp-toast");if(!el)return;el.textContent=msg;el.classList.add("show");clearTimeout(toastT);toastT=setTimeout(()=>el.classList.remove("show"),2600);}
function checkBadges(){
  const nw=BADGES.filter(b=>b.test()&&!S.badges.includes(b.id));
  if(nw.length){S.badges=[...S.badges,...nw.map(b=>b.id)];save();toast("Badge débloqué : "+nw.map(b=>b.nom).join(", "));}
}
function gain(n){toast("+"+n+" points d’élan");}

function route(){const h=(location.hash||"").slice(1);return h||"tableau";}
function routeStrip(){
  const nx=nextAtelier();
  return `<div class="route-wrap"><div class="route">${ATELIERS.map((a,i)=>{
    const st=status(a); let c=st==="jour"?"today":(S.presence[a.id]?"done":(st==="passe"?"missed":""));
    if(nx&&nx.id===a.id&&st!=="jour") c+=" next";
    const x=dt(a.d);
    return `<a class="st ${c}" href="#parcours" title="${esc(a.t)}">${(nx&&nx.id===a.id)?'<span class="you">toi</span>':""}<span class="dot">${i+1}</span><small>${a.f?"7 au 14 déc.":x.n+" "+x.m}</small></a>`;
  }).join("")}</div></div>`;
}
function missions(a){
  return `<ul class="missions">${a.prep.map((p,i)=>{const k=a.id+"-"+i,ok=!!S.prep[k];
    return `<li class="mission ${ok?"ok":""}"><button class="chk" data-act="prep" data-k="${k}" aria-pressed="${ok}" aria-label="${esc(p)}"></button><span>${esc(p)}</span></li>`;}).join("")}</ul>`;
}
function presenceBtn(a){
  const st=status(a);
  if(S.presence[a.id]) return `<span class="tag ok">Présence notée</span>`;
  if(st==="avenir") return "";
  return `<button class="btn sun" data-act="presence" data-k="${a.id}">J’y étais</button>`;
}
function resLink(r){return `<li><a href="${esc(r.url)}" target="_blank" rel="noopener" data-act="res" data-k="${r.id}">${esc(r.t)}</a>${S.res[r.id]?' <span class="tag ok">Consultée</span>':""}</li>`;}

function vTableau(){
  const pts=points(),lv=level(pts),p=position(),nx=nextAtelier();
  const weak=weakAxes(2);
  let nextCard;
  if(nx){
    const pg=page(nx.page);
    nextCard=`<div class="card"><span class="next-date">${status(nx)==="jour"?"Aujourd’hui":fdate(nx)}</span>
      <h3>${esc(nx.t)}</h3><p class="meta">${esc(nx.fmt)}, avec ${esc(nx.avec)}</p>
      <p style="margin:10px 0 0">${esc(nx.phrase)}</p>
      ${nx.alerte?`<div class="note warn">${esc(nx.alerte)}</div>`:""}
      <h4 style="margin:16px 0 0;color:var(--ink)">Tes missions pour cet atelier</h4>${missions(nx)}
      <div class="actions"><a class="btn" href="#carnet-${pg.id}">Ouvrir « ${esc(pg.titre)} »</a>${presenceBtn(nx)}</div></div>`;
  } else {
    nextCard=`<div class="card"><h3>Tous les ateliers sont passés</h3><p class="meta">Complète ta feuille de route et garde ton carnet comme base pour les 3 prochains mois.</p><div class="actions"><a class="btn" href="#carnet-route">Ma feuille de route</a></div></div>`;
  }
  const focus=diagDone()
    ? `<div class="card"><h3>Tes points d’attention</h3><p class="meta">Les deux axes les plus faibles de ton diagnostic. On les met en avant dans ton parcours et ta ressourcerie.</p>
       <div class="focus" style="margin-top:14px">${weak.map(a=>{
         const rs=RES.filter(r=>r.th===a.theme).slice(0,2);
         return `<div class="focus-item"><div class="focus-head"><strong style="color:var(--ink)">${esc(a.nom)}</strong><span class="score">${a.s}/5</span></div>
           <p class="meta" style="margin-top:4px">Ta page : <a href="#carnet-${a.page}">${esc(page(a.page).titre)}</a></p>
           <ul class="mini-res">${rs.map(resLink).join("")}</ul></div>`;}).join("")}</div></div>`
    : `<div class="card"><h3>Pose ton diagnostic</h3><p class="meta">Note ton projet sur 8 axes en deux minutes. Ton parcours et ta ressourcerie s’adaptent à tes réponses.</p><div class="actions"><a class="btn sun" href="#carnet-depart">Faire mon diagnostic</a></div></div>`;
  const carnetPct=Math.round(PAGES.reduce((s,p)=>s+pagePct(p),0)/PAGES.length);
  return `<section class="hero">
      <div><p class="hello">Bonjour ${esc(S.profil.prenom)},</p><h1 class="count">${esc(p.big)}</h1><p class="count-sub">${esc(p.small)}</p></div>
      <div class="level"><div class="lv-top"><strong>${lv.nom}</strong><span>${pts} points d’élan</span></div>
        <div class="bar"><i style="width:${lv.pct}%"></i></div>
        <p class="lv-next">${lv.next?"Encore "+(lv.next.min-pts)+" points pour atteindre le niveau "+lv.next.nom+".":"Niveau maximum atteint. Le jury n’a qu’à bien se tenir."}</p></div>
    </section>
    <section class="section"><h2>Ton chemin</h2><p class="lead">14 étapes du 16 novembre au 15 décembre. Note ta présence à chaque atelier pour avancer.</p>${routeStrip()}</section>
    <section class="section"><div class="grid2"><div><h2 style="font-size:1.45rem;margin-bottom:12px">Ta prochaine étape</h2>${nextCard}</div>
      <div><h2 style="font-size:1.45rem;margin-bottom:12px">Ton projet</h2>${focus}
      <div class="card" style="margin-top:20px"><h3>Ton carnet</h3><p class="meta">${esc(S.profil.projet||"Ton projet")}, rempli à ${carnetPct} %</p><div class="bar"><i style="width:${carnetPct}%"></i></div><div class="actions" style="margin-top:8px"><a class="btn ghost" href="#carnet">Continuer mon carnet</a></div></div></div></div></section>
    <section class="section"><h2>Tes badges</h2><p class="lead">${BADGES.filter(b=>S.badges.includes(b.id)||b.test()).length} sur ${BADGES.length} débloqués.</p>${badgesHtml()}</section>`;
}
function badgesHtml(){
  return `<div class="badges">${BADGES.map(b=>{const on=S.badges.includes(b.id)||b.test();
    return `<div class="badge ${on?"on":""}"><div class="medal" aria-hidden="true">${b.ini}</div><b>${esc(b.nom)}</b><small>${esc(b.d)}</small><span class="sr">${on?"débloqué":"à débloquer"}</span></div>`;}).join("")}</div>`;
}

function vParcours(){
  const weak=weakAxes(3).map(a=>a.id);
  return `<h1 style="font-size:clamp(2rem,6vw,3rem);letter-spacing:-.02em">Le parcours</h1>
  <p class="lead" style="color:var(--muted);margin:8px 0 0;max-width:62ch">4 séquences, 14 étapes. ${weak.length?"Les ateliers marqués « clé pour toi » travaillent les axes les plus faibles de ton diagnostic.":"Pose ton diagnostic pour voir les ateliers clés pour toi."}</p>
  ${SEQS.map(s=>`<section class="seq"><div class="seq-head"><img class="sticker" src="${IMG[STICKER_SEQ[s.id]]}" alt="" aria-hidden="true"><h2>${s.id} ${esc(s.nom)}</h2><span>${s.dates}</span></div><div class="trail">
    ${ATELIERS.filter(a=>a.seq===s.id).map(a=>{
      const st=status(a), x=dt(a.d), cle=a.axes.some(ax=>weak.includes(ax)), pg=page(a.page), nx=nextAtelier();
      const cls=S.presence[a.id]?"done":(st==="jour"?"today":"");
      return `<div class="step ${cls}"><details ${(nx&&nx.id===a.id)?"open":""}><summary>
        <div class="datebox"><b>${a.f?"7-14":x.n}</b><small>${a.f?"déc.":x.j+" "+x.m}</small></div>
        <div><div class="step-title">${esc(a.t)}</div><div class="step-sub">${esc(a.fmt)}</div></div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">${cle?'<span class="tag you4">Clé pour toi</span>':""}${S.presence[a.id]?'<span class="tag ok">Fait</span>':""}</div>
      </summary><div class="step-body">
        <p>${esc(a.phrase)}</p><p class="meta" style="margin-top:6px">Avec ${esc(a.avec)}</p>
        ${a.alerte?`<div class="note warn">${esc(a.alerte)}</div>`:""}
        <h4>À préparer</h4>${missions(a)}
        <h4>Tu repars avec</h4><p>${esc(a.repart)}</p>
        <div class="actions"><a class="btn ghost" href="#carnet-${pg.id}">Page du carnet : ${esc(pg.titre)}</a>${presenceBtn(a)}</div>
      </div></details></div>`;}).join("")}
  </div></section>`).join("")}`;
}

function field(p,f){
  const v=val(p.id,f.id), base=`data-page="${p.id}" data-field="${f.id}"`;
  const help=f.help?`<p class="help">${esc(f.help)}</p>`:"";
  const fid="f-"+p.id+"-"+f.id;
  switch(f.type){
    case "text": return `<div class="field"><label for="${fid}">${esc(f.label)}</label>${help}<input id="${fid}" ${base} value="${esc(v)}"></div>`;
    case "url": return `<div class="field"><label for="${fid}">${esc(f.label)}</label>${help}<input id="${fid}" type="url" inputmode="url" placeholder="https://" ${base} value="${esc(v)}"></div>`;
    case "number": return `<div class="field"><label for="${fid}">${esc(f.label)}</label>${help}<input id="${fid}" type="number" inputmode="numeric" min="0" ${base} value="${esc(v)}"></div>`;
    case "area": return `<div class="field"><label for="${fid}">${esc(f.label)}</label>${help}<textarea id="${fid}" ${base}>${esc(v)}</textarea></div>`;
    case "list": { const arr=Array.isArray(v)?v:[];
      return `<div class="field"><span class="lab">${esc(f.label)}</span>${help}<div class="list">${Array.from({length:f.n},(_,i)=>`<div><span>${i+1}</span><input aria-label="${esc(f.label)} ${i+1}" ${base} data-idx="${i}" value="${esc(arr[i])}"></div>`).join("")}</div></div>`; }
    case "check": { const arr=Array.isArray(v)?v:[];
      return `<div class="field"><span class="lab">${esc(f.label)}</span>${help}<div class="chips">${f.opts.map(o=>`<button class="chip" data-act="check" data-page="${p.id}" data-field="${f.id}" data-opt="${esc(o)}" aria-pressed="${arr.includes(o)}">${esc(o)}</button>`).join("")}</div></div>`; }
    case "diag": { const d=v||{};
      return `<div class="field"><span class="lab">${esc(f.label)}</span>${help}<div class="diag">${AXES.map(a=>`<div class="diag-row"><span>${esc(a.nom)}</span><div class="scale" role="group" aria-label="${esc(a.nom)}">${[1,2,3,4,5].map(n=>`<button data-act="diag" data-ax="${a.id}" data-n="${n}" aria-pressed="${d[a.id]===n}">${n}</button>`).join("")}</div></div>`).join("")}</div></div>`; }
    case "calc": { const ca=+val(p.id,"ca")||0, ch=+val(p.id,"charges")||0, r=ca-ch;
      return `<div class="calc" data-meta="calc">${(ca||ch)?`Résultat prévisionnel en année 1 : <strong>${r.toLocaleString("fr-FR")} €</strong>${r<0?" (une perte la première année est fréquente, l’important est de savoir la financer)":""}`:"Renseigne ton chiffre d’affaires et tes charges pour voir ton résultat prévisionnel."}</div>`; }
    case "counters": return `<div class="field"><span class="lab">${esc(f.label)}</span><p class="help">Chaque appel compte. 10 appels débloquent le badge Cold caller.</p><div class="counters">
      ${[["appels","Appels passés"],["rdv","Rendez-vous décrochés"]].map(([k,l])=>`<div class="counter"><b>${S.compteurs[k]}</b><span>${l}</span><div class="row"><button data-act="count" data-k="${k}" data-d="-1" aria-label="Retirer un">−</button><button data-act="count" data-k="${k}" data-d="1" aria-label="Ajouter un">+</button></div></div>`).join("")}</div></div>`;
  }
  return "";
}
function vCarnet(pid){
  const p=page(pid)||PAGES.find(x=>pagePct(x)<100)||PAGES[0];
  const a=atelier(p.atelier), i=PAGES.indexOf(p), nxt=PAGES[i+1], prv=PAGES[i-1];
  const pct=pagePct(p);
  return `<div class="carnet"><nav class="index" aria-label="Pages du carnet">${PAGES.map(x=>{const c=pagePct(x);
      return `<a href="#carnet-${x.id}" aria-current="${x.id===p.id}"><span>${esc(x.titre)}</span><span class="ring" data-ring="${x.id}" style="background:conic-gradient(var(--mint) ${c*3.6}deg,var(--surface-2) 0)"><span>${c}</span></span></a>`;}).join("")}
      <div style="padding:10px"><button class="btn ghost" data-act="export" style="width:100%;justify-content:center">Télécharger mon carnet</button></div></nav>
    <article class="page"><div class="page-head"><span class="tag">${a.id==="a14"?"7 au 15 déc.":fdate(a)}, ${esc(a.t)}</span><h2>${esc(p.titre)}</h2>
      ${p.intro?`<p class="meta">${esc(p.intro)}</p>`:""}
      <div class="bar" style="margin-bottom:0"><i data-meta="pagebar" style="width:${pct}%"></i></div><p class="meta" style="margin-top:6px"><span data-meta="pagepct">${pct}</span> % de la page rempli, 10 points par champ</p></div>
      ${p.fields.map(f=>field(p,f)).join("")}
      <div class="page-foot">${prv?`<a class="btn ghost" href="#carnet-${prv.id}">Page précédente</a>`:"<span></span>"}${nxt?`<a class="btn" href="#carnet-${nxt.id}">Page suivante : ${esc(nxt.titre)}</a>`:`<a class="btn" href="#tableau">Retour au tableau de bord</a>`}</div>
    </article></div>`;
}

let resFilter="tout", resQuery="";
function vRessources(){
  const weak=weakAxes(3).map(a=>a.theme);
  const chips=[["tout","Tout"],...(weak.length?[["pourtoi","Pour toi"]]:[]),...Object.entries(THEMES)];
  const q=resQuery.trim().toLowerCase();
  const list=RES.filter(r=>(resFilter==="tout"||(resFilter==="pourtoi"?weak.includes(r.th):r.th===resFilter))&&(!q||(r.t+" "+r.d).toLowerCase().includes(q)));
  const nb=Object.keys(S.res).length;
  return `<h1 style="font-size:clamp(2rem,6vw,3rem);letter-spacing:-.02em">La ressourcerie</h1>
  <p class="lead" style="color:var(--muted);margin:8px 0 22px;max-width:62ch">Des outils gratuits et des sites officiels, classés par thème. Chaque ressource consultée te rapporte 5 points. Tu en as consulté ${nb}.</p>
  <div class="filters"><input class="search" type="search" placeholder="Rechercher" aria-label="Rechercher une ressource" data-act="q" value="${esc(resQuery)}">
    ${chips.map(([k,l])=>`<button class="chip" data-act="filtre" data-k="${k}" aria-pressed="${resFilter===k}">${esc(l)}</button>`).join("")}</div>
  <div class="res-grid">${list.length?list.map(r=>`<div class="res"><div style="display:flex;gap:6px;flex-wrap:wrap"><span class="tag">${esc(THEMES[r.th])}</span><span class="tag" style="background:transparent;border:1px solid var(--line)">${esc(r.type)}</span>${weak.includes(r.th)?'<span class="tag you4">Pour toi</span>':""}</div>
    <h3>${esc(r.t)}</h3><p>${esc(r.d)}</p><div class="foot"><a class="open" href="${esc(r.url)}" target="_blank" rel="noopener" data-act="res" data-k="${r.id}">Ouvrir le site</a>${S.res[r.id]?'<span class="tag ok">Consultée</span>':""}</div></div>`).join(""):`<p class="empty">Aucune ressource ne correspond. Essaie un autre mot ou un autre thème.</p>`}</div>
  <section class="section"><h2>Les supports des ateliers</h2><p class="lead">Chaque support se débloque ici après son atelier.</p>
  <div class="res-grid">${ATELIERS.filter(a=>a.id!=="a13"&&a.id!=="a14").map(a=>{const open=status(a)!=="avenir";
    return `<div class="res ${open?"":"locked"}"><span class="tag">${fdate(a)}</span><h3>${esc(a.t)}</h3><p>${open?"Le support sera déposé ici par l’équipe de la Prépa.":"Disponible après l’atelier."}</p></div>`;}).join("")}</div></section>`;
}


/* ---------- En-tête et profil (version Webflow) ---------- */
function nav(cur){
  const items=[["tableau","Tableau de bord"],["parcours","Parcours"],["carnet","Mon carnet"],["ressources","Ressourcerie"],["profil","Profil"]];
  if(isAdmin) items.push(["equipe","Équipe"]);
  const base=cur.split("-")[0];
  return items.map(([h,l])=>`<a href="#${h}" ${base===h?'aria-current="page"':""}>${l}</a>`).join("");
}
function syncLabel(){return syncState==="saving"?"Enregistrement…":syncState==="err"?"Non enregistré, vérifie ta connexion":"Enregistré";}
function header(cur){
  return `<header class="pp-top"><div class="pp-top-in">
    <a class="pp-brand" href="#tableau"><img src="${IMG.logo}" alt="La Prépa" height="34"></a>
    <nav class="pp-nav" aria-label="Navigation de l’espace Prépa">${nav(cur)}</nav>
    <span class="pp-sync" data-meta="sync">${syncLabel()}</span>
    <span class="pp-pill" title="Tes points d’élan"><i></i><span data-meta="pts">${points()}</span></span>
  </div></header>`;
}
function vProfil(){
  const adminEmail = user && ADMINS.includes((user.email||"").toLowerCase());
  const opts=[["","Date réelle"],...ATELIERS.map(a=>[a.d,fdate(a)+", "+a.t]),["2026-12-16","Après la Prépa"]];
  return `<h1 class="ptitle">Ton profil</h1>
  <div class="grid2" style="margin-top:22px"><div class="card"><div class="form">
    <label>Ton prénom<input data-act="profil" data-k="prenom" value="${esc(S.profil.prenom)}"></label>
    <label>Le nom de ton projet<input data-act="profil" data-k="projet" value="${esc(S.profil.projet)}"></label>
  </div><p class="meta" style="margin-top:16px">Connecté·e avec ${esc(user.email)}. Ton espace est enregistré sur ton compte : tu le retrouves sur tous tes appareils.</p>
  <div class="actions"><button class="btn" data-act="export">Télécharger mon carnet</button><button class="btn ghost" data-act="logout">Se déconnecter</button></div></div>
  <div class="card"><h3>Une question ?</h3><p class="meta">Iriantsoa : <a href="mailto:iriantsoa@frenchtech-grandparis.com">iriantsoa@frenchtech-grandparis.com</a><br>Melissa : <a href="mailto:melissa@frenchtech-grandparis.com">melissa@frenchtech-grandparis.com</a></p>
    ${adminEmail&&!isAdmin?`<div class="note info"><strong>Accès équipe.</strong> Vérifie ton adresse email pour activer la vue équipe, puis reconnecte-toi.<div class="actions"><button class="btn sun" data-act="verify">Recevoir l’email de vérification</button></div></div>`:""}
    ${isAdmin?`<h3 style="margin-top:22px">Mode démo</h3><p class="meta">Visible par l’équipe uniquement. Simule une date pour tester ton tableau de bord.</p>
    <label class="form" style="margin-top:12px">Date simulée<select data-act="demo">${opts.map(([v,l])=>`<option value="${v}" ${S.demo===v?"selected":""}>${esc(l)}</option>`).join("")}</select></label>`:""}
  </div></div>
  <section class="section"><h2>Tes badges</h2>${badgesHtml()}</section>`;
}

/* ---------- Vue équipe ---------- */
async function loadTeam(){
  if(teamLoading) return;
  teamLoading=true; teamErr=""; team=null; render();
  try{
    const snap=await getDocs(collection(fbDb,"participants"));
    team=snap.docs.map(d=>({id:d.id,...d.data()})).filter(p=>!ADMINS.includes(String(p.email||"").toLowerCase()));
    team.sort((a,b)=>String(a.prenom||"").localeCompare(String(b.prenom||""),"fr"));
  }catch(e){ teamErr="Impossible de charger les participants. Vérifie que les règles Firestore sont publiées et que ton email est vérifié."; team=[]; }
  render();
}
function quand(ts){
  if(!ts||!ts.toDate) return "jamais";
  const d=ts.toDate(), j=Math.floor((Date.now()-d.getTime())/864e5);
  if(j<=0) return "aujourd’hui"; if(j===1) return "hier"; return "il y a "+j+" jours";
}
function vEquipe(){
  if(!isAdmin) return `<p class="empty">Cette page est réservée à l’équipe de la Prépa.</p>`;
  if(team===null){ if(!teamLoading) setTimeout(loadTeam,0); return `<h1 class="ptitle">L’équipe</h1><p class="lead" style="margin-top:10px">Chargement des participants…</p>`; }
  const T=team||[], n=T.length;
  const moy=k=>n?Math.round(T.reduce((s,p)=>s+(+p[k]||0),0)/n):0;
  const prets=T.filter(p=>(+p.contacts||0)>=15).length;
  return `<h1 class="ptitle">L’équipe</h1>
  <p class="lead" style="margin-top:10px">L’avancement de chaque participant, mis à jour à chaque enregistrement de son carnet.</p>
  ${teamErr?`<div class="note warn">${esc(teamErr)}</div>`:""}
  <div class="kpis">
    <div class="kpi"><b>${n}</b><span>participants inscrits</span></div>
    <div class="kpi"><b>${moy("carnet")} %</b><span>de carnet rempli en moyenne</span></div>
    <div class="kpi"><b>${moy("presences")}/14</b><span>présences en moyenne</span></div>
    <div class="kpi"><b>${prets}/${n}</b><span>avec au moins 15 contacts pour le bootcamp sales</span></div>
  </div>
  <div class="actions" style="margin:0 0 14px"><button class="btn ghost" data-act="team-refresh">Actualiser</button><button class="btn ghost" data-act="team-csv">Télécharger en CSV</button></div>
  <div class="table-wrap"><table><thead><tr><th>Participant</th><th>Points</th><th>Carnet</th><th>Présences</th><th>Contacts</th><th>Appels / RDV</th><th>Dernière activité</th><th></th></tr></thead><tbody>
  ${n?T.map(p=>`<tr><td class="wrap"><strong>${esc(p.prenom||"Sans prénom")}</strong><br><span class="meta">${esc(p.projet||"")}${p.projet?", ":""}${esc(p.email||"")}</span></td>
    <td>${+p.points||0}<br><span class="meta">${level(+p.points||0).nom}</span></td>
    <td>${+p.carnet||0} %</td><td>${+p.presences||0}/14</td>
    <td><span class="tag ${(+p.contacts||0)>=15?"ok":"ko"}">${+p.contacts||0}</span></td>
    <td>${+p.appels||0} / ${+p.rdv||0}</td><td>${quand(p.updatedAt)}</td>
    <td><button class="linkbtn" data-act="team-open" data-k="${esc(p.id)}">${teamOpen===p.id?"Fermer":"Voir le carnet"}</button></td></tr>
    ${teamOpen===p.id?`<tr><td colspan="8" class="wrap"><pre class="carnet-txt">${esc(carnetTexte(etatDe(p)))}</pre></td></tr>`:""}`).join(""):`<tr><td colspan="8" class="wrap"><p class="meta">Aucun participant inscrit pour l’instant. Partage le lien de la page pour qu’ils créent leur compte.</p></td></tr>`}
  </tbody></table></div>`;
}
function etatDe(p){try{return Object.assign(DEF(),JSON.parse(p.state||"{}"));}catch(e){return DEF();}}
function teamCsv(){
  const head=["Prénom","Projet","Email","Points","Niveau","Carnet (%)","Présences","Contacts","Appels","RDV"];
  const rows=(team||[]).map(p=>[p.prenom,p.projet,p.email,+p.points||0,level(+p.points||0).nom,+p.carnet||0,+p.presences||0,+p.contacts||0,+p.appels||0,+p.rdv||0]);
  const csv=[head,...rows].map(r=>r.map(c=>'"'+String(c??"").replace(/"/g,'""')+'"').join(";")).join("\n");
  telecharger("prepa-participants.csv","\ufeff"+csv,"text/csv");
}

/* ---------- Connexion ---------- */
function vAuth(){
  const t=authMode;
  const items=[["cafe","Ton parcours","Les 14 étapes du mois et ce qu’il faut préparer avant chaque atelier."],
    ["ordi","Ton carnet de l’entrepreneur","Toutes les pages du cahier, en ligne, enregistrées sur ton compte."],
    ["loupe","La ressourcerie","Des outils gratuits et des sites officiels, triés selon ton diagnostic."],
    ["trophee","Ta progression","Des points et des badges jusqu’au pitch final du 15 décembre."]];
  const head=`<img class="onb-logo" src="${IMG.logo}" alt="La Prépa"><h1>Ton espace Prépa</h1>
    <p class="onb-lead">Réservé aux participant·e·s de la promotion du 16 novembre au 15 décembre 2026.</p>
    <ul class="onb-list">${items.map(([k,ti,d])=>`<li><img src="${IMG[k]}" alt="" aria-hidden="true"><div><strong>${ti}</strong><span>${d}</span></div></li>`).join("")}</ul>
    <p class="meta">Pas encore dans la promo ? <a href="${PAGE_PROGRAMME}">Découvrir le programme</a></p>`;
  const tabs=`<div class="tabs"><button class="chip" data-act="mode" data-k="login" aria-pressed="${t==="login"}">J’ai déjà un compte</button><button class="chip" data-act="mode" data-k="signup" aria-pressed="${t==="signup"}">Créer mon compte</button></div>`;
  const msg=(authErr?`<p class="err" role="alert">${esc(authErr)}</p>`:"")+(authMsg?`<div class="note info">${esc(authMsg)}</div>`:"");
  let form;
  if(t==="signup") form=`<form class="form card" id="pp-signup">
      <label>Ton prénom<input name="prenom" required autocomplete="given-name"></label>
      <label>Le nom de ton projet<input name="projet" placeholder="Même provisoire"></label>
      <label>Ton projet en 3 mots<input name="mots"></label>
      <label>Ton email<input name="email" type="email" required autocomplete="email"></label>
      <label>Choisis un mot de passe<input name="mdp" type="password" required minlength="6" autocomplete="new-password"><span class="meta" style="font-weight:400">6 caractères minimum</span></label>
      ${msg}<button class="btn sun" type="submit">Créer mon espace</button></form>`;
  else if(t==="reset") form=`<form class="form card" id="pp-reset">
      <label>Ton email<input name="email" type="email" required autocomplete="email"></label>
      ${msg}<button class="btn" type="submit">Recevoir le lien de réinitialisation</button>
      <button class="linkbtn" type="button" data-act="mode" data-k="login">Retour à la connexion</button></form>`;
  else form=`<form class="form card" id="pp-login">
      <label>Ton email<input name="email" type="email" required autocomplete="email"></label>
      <label>Ton mot de passe<input name="mdp" type="password" required autocomplete="current-password"></label>
      ${msg}<button class="btn" type="submit">Me connecter</button>
      <button class="linkbtn" type="button" data-act="mode" data-k="reset">Mot de passe oublié ?</button></form>`;
  return `<div class="onb"><div class="onb-intro">${head}</div><div class="onb-card">${t==="reset"?"":tabs}${form}</div></div>`;
}
function vProfilManquant(){
  return `<div class="onb"><div class="onb-card"><h1>Bienvenue !</h1><p class="onb-lead">Encore deux infos pour créer ton espace.</p>
    <form class="form card" id="pp-onb"><label>Ton prénom<input name="prenom" required autocomplete="given-name"></label>
    <label>Le nom de ton projet<input name="projet"></label><button class="btn sun" type="submit">Continuer</button></form></div></div>`;
}
const ERREURS={
  "auth/invalid-credential":"Email ou mot de passe incorrect.",
  "auth/wrong-password":"Email ou mot de passe incorrect.",
  "auth/user-not-found":"Aucun compte avec cet email. Crée ton compte.",
  "auth/email-already-in-use":"Un compte existe déjà avec cet email. Connecte-toi.",
  "auth/weak-password":"Le mot de passe doit faire au moins 6 caractères.",
  "auth/invalid-email":"Cet email n’est pas valide.",
  "auth/too-many-requests":"Trop de tentatives. Réessaie dans quelques minutes.",
  "auth/network-request-failed":"Connexion internet indisponible. Réessaie.",
  "auth/unauthorized-domain":"Ce site n’est pas encore autorisé dans Firebase (Authentication, Paramètres, Domaines autorisés)."
};
const msgErr=e=>ERREURS[e&&e.code]||"Une erreur est survenue. Réessaie, ou écris à l’équipe de la Prépa.";

/* ---------- Rendu principal ---------- */
function render(){
  if(!ROOT) return;
  let html;
  if(configError) html=`<main><div class="note warn">${esc(configError)}</div></main>`;
  else if(!ready) html=`<main><p class="lead">Chargement de ton espace Prépa…</p></main>`;
  else if(!user) html=vAuth();
  else if(!S.profil.prenom) html=vProfilManquant();
  else {
    const r=route(); let body;
    if(r==="parcours") body=vParcours();
    else if(r==="carnet"||r.startsWith("carnet-")) body=vCarnet(r.slice(7));
    else if(r==="ressources") body=vRessources();
    else if(r==="profil") body=vProfil();
    else if(r==="equipe") body=vEquipe();
    else body=vTableau();
    html=header(r)+`<main>${body}</main>`;
  }
  ROOT.innerHTML=html+`<div class="pp-toast" id="pp-toast" role="status" aria-live="polite"></div>`;
}
function setSync(s){syncState=s;const el=ROOT&&ROOT.querySelector('[data-meta="sync"]');if(el) el.textContent=syncLabel();}
function refreshMeta(pid){
  ROOT.querySelectorAll('[data-meta="pts"]').forEach(e=>e.textContent=points());
  if(!pid) return; const p=page(pid), c=pagePct(p);
  const pb=ROOT.querySelector('[data-meta="pagebar"]'); if(pb) pb.style.width=c+"%";
  const pp=ROOT.querySelector('[data-meta="pagepct"]'); if(pp) pp.textContent=c;
  const rg=ROOT.querySelector(`[data-ring="${pid}"]`); if(rg){rg.style.background=`conic-gradient(var(--mint) ${c*3.6}deg,var(--surface-2) 0)`;rg.firstElementChild.textContent=c;}
  if(pid==="chiffres"){const el=ROOT.querySelector('[data-meta="calc"]'); if(el){const t=document.createElement("div");t.innerHTML=field(p,{id:"calc",type:"calc"});el.replaceWith(t.firstElementChild);}}
}

/* ---------- Enregistrement ---------- */
function resume(){
  const pct=Math.round(PAGES.reduce((s,p)=>s+pagePct(p),0)/PAGES.length);
  return {state:JSON.stringify(S),email:(user.email||"").toLowerCase(),prenom:S.profil.prenom||"",projet:S.profil.projet||"",
    points:points(),carnet:pct,presences:Object.keys(S.presence).length,contacts:+val("acquisition","nb")||0,
    appels:S.compteurs.appels||0,rdv:S.compteurs.rdv||0,updatedAt:serverTimestamp()};
}
async function saveNow(){
  clearTimeout(saveTimer); saveTimer=null;
  if(!user||!fbDb) return;
  try{ await setDoc(doc(fbDb,"participants",user.uid),resume()); setSync("ok"); }
  catch(e){ setSync("err"); }
}
function save(){ S.updatedAt=Date.now(); setSync("saving"); clearTimeout(saveTimer); saveTimer=setTimeout(saveNow,1200); }
document.addEventListener("visibilitychange",()=>{ if(document.visibilityState==="hidden"&&saveTimer) saveNow(); });
window.addEventListener("beforeunload",e=>{ if(saveTimer){ saveNow(); e.preventDefault(); e.returnValue=""; } });

/* ---------- Export du carnet ---------- */
function carnetTexte(st){
  const prev=S; if(st) S=st;
  let out=`CARNET DE L’ENTREPRENEUR, LA PRÉPA\n${S.profil.prenom}${S.profil.projet?", "+S.profil.projet:""}\n`;
  PAGES.forEach(p=>{
    out+=`\n## ${p.titre}\n`;
    p.fields.forEach(f=>{
      const v=val(p.id,f.id);
      if(f.type==="calc") return;
      if(f.type==="diag"){out+=`\n${f.label}\n`;AXES.forEach(a=>out+=`- ${a.nom} : ${(v||{})[a.id]||"?"}/5\n`);return;}
      if(f.type==="counters"){out+=`\nAppels passés : ${S.compteurs.appels}, rendez-vous : ${S.compteurs.rdv}\n`;return;}
      const t=Array.isArray(v)?v.filter(x=>x&&String(x).trim()).map(x=>"- "+x).join("\n"):(v??"");
      out+=`\n${f.label}\n${t||"(à compléter)"}\n`;
    });
  });
  S=prev; return out;
}
function telecharger(nom,contenu,type){
  const url=URL.createObjectURL(new Blob([contenu],{type:(type||"text/markdown")+";charset=utf-8"}));
  const a=document.createElement("a"); a.href=url; a.download=nom; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),2000);
}

/* ---------- Interactions ---------- */
ROOT && ROOT.addEventListener("click",async e=>{
  const el=e.target.closest("[data-act]"); if(!el) return;
  const act=el.dataset.act, k=el.dataset.k;
  if(act==="prep"){ if(S.prep[k]) delete S.prep[k]; else {S.prep[k]=1;gain(5);} save(); render(); checkBadges(); }
  else if(act==="presence"){ S.presence[k]=1; save(); render(); gain(20); checkBadges(); }
  else if(act==="res"){ if(!S.res[k]){S.res[k]=1;save();gain(5);setTimeout(()=>{render();checkBadges();},50);} }
  else if(act==="check"){ const p=el.dataset.page,f=el.dataset.field,o=el.dataset.opt; let arr=Array.isArray(val(p,f))?[...val(p,f)]:[]; arr=arr.includes(o)?arr.filter(x=>x!==o):[...arr,o]; setVal(p,f,arr); save(); el.setAttribute("aria-pressed",arr.includes(o)); refreshMeta(p); checkBadges(); }
  else if(act==="diag"){ const d={...(val("depart","diag")||{})}; d[el.dataset.ax]=+el.dataset.n; setVal("depart","diag",d); save(); el.parentElement.querySelectorAll("button").forEach(b=>b.setAttribute("aria-pressed",b===el)); refreshMeta("depart"); checkBadges(); }
  else if(act==="count"){ S.compteurs[k]=Math.max(0,S.compteurs[k]+(+el.dataset.d)); save(); el.closest(".counter").querySelector("b").textContent=S.compteurs[k]; refreshMeta("sales"); checkBadges(); }
  else if(act==="filtre"){ resFilter=k; render(); }
  else if(act==="export"){ telecharger("carnet-prepa.md",carnetTexte()); }
  else if(act==="mode"){ authMode=k; authErr=""; authMsg=""; render(); }
  else if(act==="logout"){ await saveNow(); await signOut(fbAuth); location.hash=""; }
  else if(act==="verify"){ try{ await sendEmailVerification(user); toast("Email envoyé. Clique sur le lien, puis reconnecte-toi."); }catch(err){ toast(msgErr(err)); } }
  else if(act==="team-refresh"){ loadTeam(); }
  else if(act==="team-csv"){ teamCsv(); }
  else if(act==="team-open"){ teamOpen=teamOpen===k?"":k; render(); }
});
ROOT && ROOT.addEventListener("input",e=>{
  const el=e.target;
  if(el.dataset.field){
    const p=el.dataset.page,f=el.dataset.field;
    if(el.dataset.idx!==undefined){const arr=Array.isArray(val(p,f))?[...val(p,f)]:[];arr[+el.dataset.idx]=el.value;setVal(p,f,arr);}
    else setVal(p,f,el.value);
    save(); refreshMeta(p);
  } else if(el.dataset.act==="q"){ resQuery=el.value; const pos=el.selectionStart; render(); const s=ROOT.querySelector('[data-act="q"]'); if(s){s.focus();s.setSelectionRange(pos,pos);} }
  else if(el.dataset.act==="profil"){ S.profil[el.dataset.k]=el.value; save(); }
});
ROOT && ROOT.addEventListener("change",e=>{
  const el=e.target;
  if(el.dataset.field) checkBadges();
  if(el.dataset.act==="demo"){ S.demo=el.value; save(); render(); toast(el.value?"Date simulée activée":"Retour à la date réelle"); }
  if(el.dataset.act==="profil") render();
});
ROOT && ROOT.addEventListener("submit",async e=>{
  const id=e.target.id; if(!["pp-login","pp-signup","pp-reset","pp-onb"].includes(id)) return;
  e.preventDefault();
  const fd=new FormData(e.target), g=n=>String(fd.get(n)||"").trim();
  const btn=e.target.querySelector('button[type="submit"]'); if(btn) btn.disabled=true;
  authErr=""; authMsg="";
  try{
    if(id==="pp-login") await signInWithEmailAndPassword(fbAuth,g("email"),String(fd.get("mdp")||""));
    else if(id==="pp-signup"){ pending={prenom:g("prenom"),projet:g("projet"),mots:g("mots")}; await createUserWithEmailAndPassword(fbAuth,g("email"),String(fd.get("mdp")||"")); }
    else if(id==="pp-reset"){ await sendPasswordResetEmail(fbAuth,g("email")); authMsg="Si un compte existe avec cet email, tu vas recevoir un lien pour choisir un nouveau mot de passe. Pense à regarder tes spams."; render(); }
    else if(id==="pp-onb"){ S.profil.prenom=g("prenom"); S.profil.projet=g("projet"); await saveNow(); location.hash="#tableau"; render(); checkBadges(); }
  }catch(err){ authErr=msgErr(err); pending=null; render(); }
});
window.addEventListener("hashchange",()=>{ if(user){ render(); ROOT.scrollIntoView({block:"start"}); } });

/* ---------- Démarrage ---------- */
render();
if(fbAuth){
  onAuthStateChanged(fbAuth, async u=>{
    user=u; team=null; teamOpen="";
    if(!u){ S=DEF(); isAdmin=false; ready=true; render(); return; }
    const mail=(u.email||"").toLowerCase();
    if(ADMINS.includes(mail)&&!u.emailVerified){ try{ await u.reload(); await u.getIdToken(true); }catch(e){} }
    isAdmin=ADMINS.includes(mail)&&!!fbAuth.currentUser.emailVerified;
    try{
      const snap=await getDoc(doc(fbDb,"participants",u.uid));
      if(snap.exists()&&snap.data().state){ S=Object.assign(DEF(),JSON.parse(snap.data().state)); }
      else{
        S=DEF();
        if(pending){ S.profil.prenom=pending.prenom; S.profil.projet=pending.projet; if(pending.mots) setVal("depart","mots",pending.mots); }
        if(S.profil.prenom) await saveNow();
      }
    }catch(e){ S=DEF(); authErr="Impossible de charger ton espace. Vérifie ta connexion puis recharge la page."; }
    pending=null; ready=true; render(); checkBadges();
  });
}
