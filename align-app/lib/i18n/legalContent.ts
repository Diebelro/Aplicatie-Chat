import type { Locale } from "./types";
import type { LegalSection } from "./types";

const termsRO: LegalSection[] = [
  {
    title: "1. Prezentare generală",
    content: [
      "Bine ați venit la Diebel („Serviciul”). Prin utilizarea aplicației și a site-ului, acceptați acești Termeni și Condiții. Serviciul este oferit de operatorul nostru și este destinat utilizatorilor cu vârsta de cel puțin 18 ani.",
      "Serviciul permite înregistrarea, crearea de profil, căutarea de potriviri și comunicarea cu alți utilizatori în conformitate cu funcționalitățile puse la dispoziție. Utilizarea este supusă legislației aplicabile, inclusiv Regulamentului (UE) 2016/679 (GDPR).",
    ],
  },
  {
    title: "2. Eligibilitate și cont",
    content: [
      "Trebuie să aveți cel puțin 18 ani și să aveți capacitatea legală de a încheia un contract valid. Prin înregistrare, declarați că informațiile furnizate sunt corecte și complete.",
      "Sunteți responsabil pentru confidențialitatea contului și a parolei. Notifică-ne orice utilizare neautorizată. Păstrăm dreptul de a suspenda sau închide conturi care încalcă acești termeni sau politicile noastre.",
    ],
  },
  {
    title: "3. Conținut și comportament",
    content: [
      "Nu aveți dreptul să postați conținut ilegal, defăimător, obscen, hărțuitor sau care încalcă drepturile terților. Interzicem exploatarea comercială neautorizată, spam-ul, boturile și practicile înșelătoare.",
      "Ne rezervăm dreptul de a elimina sau restricționa conținutul care contravine politicilor aplicabile, fără notificare prealabilă în cazurile în care legea permite acest lucru.",
      "Modul în care sunt prelucrate mesajele și fișierele din chat, inclusiv accesul limitat al personalului autorizat în situații concrete, este descris în Politica de confidențialitate, disponibilă public pe site-ul Serviciului.",
    ],
  },
  {
    title: "4. Moderare, securitate și cooperare cu autoritățile",
    content: [
      "Putem lua măsuri asupra conținutului disponibil în Serviciu (inclusiv mesaje, imagini sau fișiere atașate și elemente de profil) atunci când este necesar pentru respectarea Termenilor, protejarea utilizatorilor, prevenirea fraudelor și abuzurilor sau îndeplinirea obligațiilor legale. Aceste măsuri sunt proporționale și nu înseamnă monitorizare continuă sau citire sistematică a conversațiilor.",
      "Accesul personalului autorizat la conținut este limitat, bazat pe necesitate și aliniat Politicii de confidențialitate — de exemplu în cazuri de raportare, cereri legale valide ori investigații de securitate sau abuz.",
      "Cooperăm cu autoritățile publice competente când legea ne impune sau ne permite, inclusiv prin furnizarea de informații în urma unei cereri legale temeinice (ex. ordonanțe, hotărâri judecătorești, în condițiile legii aplicabile).",
    ],
  },
  {
    title: "5. Proprietate intelectuală și licențe",
    content: [
      "Conținutul creat de voi (texte, imagini) vă rămâne proprietatea. Acordați în schimb o licență nelimitată, neexclusivă, royalty-free, sublicențiabilă și transferabilă către noi pentru a folosi, reproduce, modifica și afișa acel conținut în scopul furnizării Serviciului și a îmbunătățirii acestuia.",
      "Marca, logo-urile și materialele noastre sunt protejate. Nu este permisă utilizarea lor fără acord scris prealabil.",
    ],
  },
  {
    title: "6. Limitarea răspunderii",
    content: [
      "Serviciul este furnizat „ca atare”. Nu garantăm funcționarea neîntreruptă sau lipsa erorilor. Nu suntem răspunzători pentru daune indirecte, consecvente sau punitive rezultate din utilizarea sau imposibilitatea utilizării Serviciului.",
      "Răspunderea noastră totală este limitată, în măsura permisă de lege, la suma plătită de dvs. în ultimele 12 luni sau la o sumă echivalentă stabilită de lege.",
    ],
  },
  {
    title: "7. Modificări și legea aplicabilă",
    content: [
      "Putem actualiza acești Termeni. Modificările semnificative vor fi comunicate prin Serviciu sau prin email. Utilizarea continuată după intrarea în vigoare constituie acceptul dvs.",
      "Acești Termeni sunt guvernați de legea română. Litigiile vor fi soluționate de instanțele române competente, cu respectarea drepturilor consumatorilor conform legislației UE.",
    ],
  },
  {
    title: "8. Contact",
    content: [
      "Pentru orice solicitare legată de datele tale personale (inclusiv ștergerea contului — și prin Setările contului din aplicație, unde este disponibil — rectificare sau întrebări privind confidențialitatea), ne poți contacta la contact@diebel.ro. Poți solicita acces și portabilitate a datelor printr-o solicitare la emailul de contact. Vom răspunde în cel mai scurt timp posibil, în conformitate cu legislația aplicabilă.",
      "Site web oficial al serviciului: https://chat.diebel.ro",
    ],
  },
  {
    title: "9. Interdicții tehnice",
    content: [
      "Este strict interzis: reverse engineering-ul (decompilarea, dezasamblarea sau încercarea de a obține codul sursă sau logica aplicației), scraping-ul automatizat sau colectarea masivă de date de pe Serviciu, copierea sau reproducerea interfeței (UI) și a experienței utilizatorului (UX), reproducerea logicii aplicației sau a funcționalităților acesteia, precum și redistribuirea conținutului fără acord scris prealabil.",
      "Utilizarea de boturi, scripturi sau instrumente automate pentru a accesa sau extrage date, profiluri sau conținut din Serviciu este interzisă. Încălcarea acestor interdicții poate duce la suspendarea contului și la măsuri legale.",
    ],
  },
];

const termsEN: LegalSection[] = [
  {
    title: "1. Overview",
    content: [
      "Welcome to Diebel (the \"Service\"). By using the application and website, you agree to these Terms and Conditions. The Service is provided by our operator and is intended for users aged at least 18.",
      "The Service allows registration, profile creation, match discovery and communication with other users in accordance with the features made available. Use is subject to applicable law, including Regulation (EU) 2016/679 (GDPR).",
    ],
  },
  {
    title: "2. Eligibility and account",
    content: [
      "You must be at least 18 years old and have the legal capacity to enter into a valid contract. By registering, you represent that the information provided is accurate and complete.",
      "You are responsible for the confidentiality of your account and password. Notify us of any unauthorized use. We reserve the right to suspend or close accounts that violate these terms or our policies.",
    ],
  },
  {
    title: "3. Content and conduct",
    content: [
      "You may not post illegal, defamatory, obscene, harassing or third-party rights-infringing content. We prohibit unauthorized commercial exploitation, spam, bots and deceptive practices.",
      "We may remove or restrict material that violates our applicable policies, without prior notice where the law allows.",
      "How we process chat messages and files, and when authorised staff may access content in specific circumstances, is described in the Privacy Policy on the Service website.",
    ],
  },
  {
    title: "4. Moderation, security and cooperation with authorities",
    content: [
      "We may take action on content available through the Service (including messages, images or attachments and profile elements) when necessary to enforce these Terms, protect users, prevent fraud and abuse, or meet legal obligations. Such action is proportionate and does not mean continuous monitoring or systematic reading of conversations.",
      "Authorised staff access to content is limited, need-based, and in line with the Privacy Policy — for example in response to a report, a valid legal request, or a security or abuse investigation.",
      "We cooperate with competent public authorities when the law requires or permits, including by providing information following a lawful request (e.g. orders or court decisions, subject to applicable law).",
    ],
  },
  {
    title: "5. Intellectual property and licences",
    content: [
      "Content you create (text, images) remains your property. You grant us a non-exclusive, royalty-free, sublicensable and transferable licence to use, reproduce, modify and display that content for the purpose of providing and improving the Service.",
      "Our brand, logos and materials are protected. Their use without prior written consent is not permitted.",
    ],
  },
  {
    title: "6. Limitation of liability",
    content: [
      "The Service is provided \"as is\". We do not guarantee uninterrupted operation or the absence of errors. We are not liable for indirect, consequential or punitive damages resulting from use or inability to use the Service.",
      "Our total liability is limited, to the extent permitted by law, to the amount paid by you in the last 12 months or to an equivalent amount under applicable law.",
    ],
  },
  {
    title: "7. Changes and governing law",
    content: [
      "We may update these Terms. Significant changes will be communicated via the Service or by email. Continued use after the effective date constitutes your acceptance.",
      "These Terms are governed by the law of Romania. Disputes will be resolved by the competent Romanian courts, with due regard to consumer rights under EU law.",
    ],
  },
  {
    title: "8. Contact",
    content: [
      "For any request related to your personal data (including account deletion — also via in-app account settings where available — rectification, or privacy questions), you can contact us at contact@diebel.ro. You can request access and data portability by contacting us via the support email. We will respond as soon as possible in accordance with applicable data protection laws.",
      "Official service website: https://chat.diebel.ro",
    ],
  },
  {
    title: "9. Technical prohibitions",
    content: [
      "You are strictly prohibited from: reverse engineering (decompiling, disassembling or attempting to obtain the source code or logic of the application), automated scraping or mass collection of data from the Service, copying or reproducing the user interface (UI) or user experience (UX), reproducing the application logic or its functionality, or redistributing content without prior written consent.",
      "The use of bots, scripts or automated tools to access or extract data, profiles or content from the Service is prohibited. Violation of these prohibitions may result in account suspension and legal action.",
    ],
  },
];

const termsDE: LegalSection[] = [
  {
    title: "1. Überblick",
    content: [
      "Willkommen bei Diebel (der \"Dienst\"). Mit der Nutzung der Anwendung und der Website akzeptieren Sie diese Allgemeinen Geschäftsbedingungen. Der Dienst wird von unserem Betreiber bereitgestellt und richtet sich an Nutzer ab 18 Jahren.",
      "Der Dienst ermöglicht Registrierung, Profilerstellung, Match-Entdeckung und Kommunikation mit anderen Nutzern gemäß den bereitgestellten Funktionen. Die Nutzung unterliegt dem geltenden Recht, einschließlich der Verordnung (EU) 2016/679 (DSGVO).",
    ],
  },
  {
    title: "2. Berechtigung und Konto",
    content: [
      "Sie müssen mindestens 18 Jahre alt sein und die rechtliche Fähigkeit haben, einen gültigen Vertrag zu schließen. Mit der Registrierung bestätigen Sie, dass die angegebenen Informationen richtig und vollständig sind.",
      "Sie sind für die Vertraulichkeit Ihres Kontos und Passworts verantwortlich. Benachrichtigen Sie uns über unbefugte Nutzung. Wir behalten uns vor, Konten zu sperren oder zu schließen, die gegen diese Bedingungen oder unsere Richtlinien verstoßen.",
    ],
  },
  {
    title: "3. Inhalte und Verhalten",
    content: [
      "Sie dürfen keine illegalen, verleumderischen, obszönen, belästigenden oder rechtsverletzenden Inhalte veröffentlichen. Unerlaubte kommerzielle Nutzung, Spam, Bots und täuschende Praktiken sind untersagt.",
      "Wir können Inhalte entfernen oder einschränken, die gegen unsere geltenden Richtlinien verstoßen, ohne vorherige Benachrichtigung, soweit das Gesetz dies erlaubt.",
      "Wie Chat-Nachrichten und Dateien verarbeitet werden und wann autorisiertes Personal in konkreten Situationen zugreifen kann, ist in der Datenschutzrichtlinie auf der Website des Dienstes beschrieben.",
    ],
  },
  {
    title: "4. Moderation, Sicherheit und Behördenzusammenarbeit",
    content: [
      "Wir können inhaltliche Maßnahmen ergreifen (einschließlich bei Nachrichten, Bildern, Anhängen und Profilelementen), wenn dies zur Durchsetzung dieser Bedingungen, zum Schutz von Nutzern, zur Betrugs- und Missbrauchsbekämpfung oder zur Erfüllung gesetzlicher Pflichten erforderlich ist. Solche Maßnahmen sind verhältnismäßig und bedeuten keine kontinuierliche Überwachung oder systematische Durchsicht von Gesprächen.",
      "Zugriffe autorisierter Mitarbeitender erfolgen begrenzt, bedarfsorientiert und gemäß der Datenschutzrichtlinie — etwa bei Meldungen, gültigen rechtlichen Anfragen oder Sicherheits- und Missbrauchsersuchen.",
      "Wir arbeiten mit zuständigen Behörden zusammen, wenn das Gesetz es verlangt oder erlaubt, einschließlich der Bereitstellung von Informationen aufgrund rechtmäßiger Anfragen (z. B. Anordnungen oder gerichtliche Entscheidungen, vorbehaltlich des anwendbaren Rechts).",
    ],
  },
  {
    title: "5. Geistiges Eigentum und Lizenzen",
    content: [
      "Von Ihnen erstellte Inhalte (Texte, Bilder) bleiben Ihr Eigentum. Sie räumen uns eine nicht-exklusive, gebührenfreie, unterlizenzierbare und übertragbare Lizenz ein, diese Inhalte zum Zwecke der Bereitstellung und Verbesserung des Dienstes zu nutzen, zu vervielfältigen, zu ändern und anzuzeigen.",
      "Unsere Marke, Logos und Materialien sind geschützt. Ihre Nutzung ohne vorherige schriftliche Zustimmung ist nicht gestattet.",
    ],
  },
  {
    title: "6. Haftungsbeschränkung",
    content: [
      "Der Dienst wird \"wie besehen\" bereitgestellt. Wir garantieren keinen unterbrechungsfreien Betrieb oder die Abwesenheit von Fehlern. Wir haften nicht für indirekte, Folgeschäden oder Strafschäden aus der Nutzung oder der Unmöglichkeit der Nutzung des Dienstes.",
      "Unsere Gesamthaftung ist im gesetzlich zulässigen Umfang auf den Betrag beschränkt, den Sie in den letzten 12 Monaten gezahlt haben, oder auf einen gesetzlich festgelegten Äquivalentbetrag.",
    ],
  },
  {
    title: "7. Änderungen und anwendbares Recht",
    content: [
      "Wir können diese Bedingungen aktualisieren. Wesentliche Änderungen werden über den Dienst oder per E-Mail mitgeteilt. Fortgesetzte Nutzung nach dem Inkrafttreten gilt als Ihre Zustimmung.",
      "Diese Bedingungen unterliegen dem Recht Rumäniens. Streitigkeiten werden von den zuständigen rumänischen Gerichten unter Beachtung der Verbraucherrechte nach EU-Recht entschieden.",
    ],
  },
  {
    title: "8. Kontakt",
    content: [
      "Für alle Anfragen im Zusammenhang mit Ihren personenbezogenen Daten (einschließlich Kontolöschung — auch über die Kontoeinstellungen in der App, soweit verfügbar — Berichtigung oder Fragen zum Datenschutz) können Sie uns unter contact@diebel.ro erreichen. Sie können Auskunft und Datenübertragbarkeit per Anfrage an die Support‑E‑Mail anfordern. Wir beantworten Ihre Anfrage so schnell wie möglich gemäß den geltenden Datenschutzgesetzen.",
      "Offizielle Website des Dienstes: https://chat.diebel.ro",
    ],
  },
  {
    title: "9. Technische Verbote",
    content: [
      "Es ist strikt untersagt: Reverse Engineering (Dekompilierung, Disassemblierung oder der Versuch, den Quellcode oder die Logik der Anwendung zu erhalten), automatisiertes Scraping oder massenhafte Datenerfassung vom Dienst, Kopieren oder Vervielfältigen der Benutzeroberfläche (UI) oder Nutzererfahrung (UX), Reproduzierung der Anwendungslogik oder ihrer Funktionalität sowie Weiterverbreiten von Inhalten ohne vorherige schriftliche Zustimmung.",
      "Die Nutzung von Bots, Skripten oder automatisierten Tools zum Zugriff auf oder zur Extraktion von Daten, Profilen oder Inhalten aus dem Dienst ist untersagt. Verstöße können zur Kontosperrung und zu rechtlichen Schritten führen.",
    ],
  },
];

const privacyRO: LegalSection[] = [
  {
    title: "Pe scurt (Diebel, magazine de aplicații)",
    content: [
      "Diebel este o aplicație de chat și apeluri pentru adulți: mesaje, descoperire de persoane și convorbiri audio sau video. Această secțiune rezumă, pentru magazine precum Google Play, ce categorii de date pot fi implicate.",
      "Autentificarea utilizatorilor se realizează prin metode puse la dispoziție de serviciu sau de furnizori terți, în funcție de configurația activă. Pot fi prelucrate, printre altele: date de cont și autentificare (inclusiv, după caz, email și alte date furnizate în fluxul de autentificare activ), conținutul mesajelor trimise în serviciu, date tehnice necesare funcționării (de exemplu dispozitiv, rețea) și informații pentru notificări push (tokenuri), folosite pentru alerte (mesaje noi, apeluri etc.) când permiți notificările pe dispozitiv.",
      "Nu vindem și nu închiriem datele tale personale către terți în scopuri comerciale ale acestora.",
      "Folosim datele pentru funcționalitatea aplicației și pentru scopuri strict necesare și aliniate: autentificare, profil, chat, apeluri, notificări, securitate, întreținere tehnică și respectarea Termenilor și legii. Nu folosim conținutul mesajelor în scopuri de publicitate, profilare de marketing sau analiză de marketing asupra conversațiilor.",
      "Procesăm doar datele minime necesare pentru funcționarea Serviciului, iar datele sunt protejate prin criptare în tranzit (HTTPS/TLS) acolo unde sunt transmise între aplicație și servere.",
      "Pentru întrebări despre date sau exercitarea drepturilor: contact@diebel.ro. Site web: https://chat.diebel.ro. Detaliile complete urmează mai jos.",
    ],
  },
  {
    title: "1. Responsabil pentru date",
    content: [
      "Operatorul serviciului Diebel este responsabil pentru prelucrarea datelor cu caracter personal („Responsabil”). Datele sunt prelucrate în conformitate cu Regulamentul (UE) 2016/679 (GDPR) și legislația națională aplicabilă.",
    ],
  },
  {
    title: "2. Date colectate",
    content: [
      "Colectăm: date de identificare (email, nume, dată nașterii, gen); date de profil (descriere, preferințe, poze, oraș, educație, ocupație); date de comunicare (mesaje text și fișiere atașate trimise în aplicație, în limitele funcționalității); date tehnice (adresă IP, tip dispozitiv, browser și identificatori tehnici operaționali — pot include semnale tehnice de la dispozitiv sau browser — folosiți pentru sesiune, securitate, prevenirea abuzurilor și furnizarea serviciului; nu pentru publicitate proprie); date de utilizare (acțiuni în aplicație, potriviri, vizite); și, cu acordul dvs., date de locație (pentru distanță față de alți utilizatori).",
      "Cookie-urile și tehnologii similare sunt descrise în Politica de Cookie-uri.",
    ],
  },
  {
    title: "3. Temeiuri legale",
    content: [
      "Prelucrăm datele pe baza: (a) consimțământului (marketing, cookie-uri opționale, locație); (b) executării contractului (furnizarea serviciului, autentificare, mesagerie); (c) interesului legitim (securitate, prevenirea fraudelor, îmbunătățirea serviciului, analize agregate); (d) obligației legale (păstrarea documentelor, răspuns la cereri autorizate).",
    ],
  },
  {
    title: "4. Drepturile tale (GDPR)",
    content: [
      "Aveți dreptul la: acces la datele dvs.; rectificare; ștergere („dreptul de a fi uitat”); restricționarea prelucrării; portabilitatea datelor; opoziție; retragerea consimțământului (fără a afecta legalitatea prelucrării anterioare); și depunere de plângere la autoritatea de supraveghere (ANSPDCP în România).",
      "Pentru exercitarea drepturilor, contactați-ne la adresa de email indicată în Politica de Confidențialitate sau în aplicație. Poți solicita acces și portabilitate a datelor printr-o solicitare la emailul de contact. Poți solicita și ștergerea contului din Setările contului din aplicație (cu confirmare prin parolă), acolo unde această opțiune este disponibilă. Răspundem în termen de 30 de zile.",
    ],
  },
  {
    title: "5. Păstrarea datelor",
    content: [
      "Păstrăm datele atât cât este necesar pentru furnizarea serviciului, relația contractuală și obligațiile legale. Dacă îți ștergi contul din aplicație (unde funcția este disponibilă, cu confirmare prin parolă), datele principale asociate contului sunt eliminate din sistemele active; copiile reziduale din backup-uri sau jurnale de securitate pot persista pentru o perioadă limitată înainte de rotire sau ștergere (de regulă până la 90 de zile), cu excepția datelor pe care legea impune să le păstrăm mai mult timp.",
      "Logurile de securitate și backup-urile pot conține copii temporare; acestea sunt rotite și șterse conform politicii interne.",
    ],
  },
  {
    title: "6. Securitate și destinatari",
    content: [
      "Aplicăm măsuri tehnice și organizatorice adecvate pentru a proteja datele: în primul rând comunicația între aplicație și servere este protejată în tranzit (HTTPS/TLS), accesul la date în backend este restricționat, iar personalul relevant este instruit. Limitele specifice ale infrastructurii (inclusiv stocarea pe server) depind de furnizorii noștri și de configurația curentă.",
      "Furnizorii operaționali (găzduire, stocare, email, notificări, securitate etc.) pot prelucra date doar în numele nostru și numai în măsura necesară furnizării acestor servicii.",
      "Nu vindem datele cu caracter personal și nu le partajăm cu terți pentru scopurile lor independente de publicitate, profilare sau marketing. Nu transferăm date în afara SEE fără baza legală adecvată (decizie de adecvare, garanții, clauze standard).",
    ],
  },
  {
    title: "7. Mesaje, fișiere atașate și imagini în chat",
    content: [
      "Mesajele text și fișierele pe care le trimiteți prin Serviciu (inclusiv imagini, documente PDF și alte tipuri permise de funcționalitate) sunt prelucrate pentru a le transmite destinatarilor, pentru a afișa istoricul conversației și pentru mesagerie.",
      "Acest conținut poate fi stocat pe infrastructura noastră sau a furnizorilor implicați în găzduire, stocare și securitate, pe durata necesară furnizării serviciului și în concordanță cu secțiunea privind păstrarea datelor.",
      "Nu accesăm sau analizăm conținutul mesajelor în mod sistematic. În situații limitate, conținutul poate fi consultat când este necesar pentru funcționarea sigură a serviciului, întreținere tehnică, soluționarea raportărilor de abuz, securitate sau îndeplinirea obligațiilor legale. Nu folosim conținutul mesajelor în scopuri de publicitate, profilare de marketing sau analiză de marketing asupra conversațiilor.",
      "Atașamentele din chat sunt afișate participanților autentificați la conversație și sunt păstrate, acolo unde configurația tehnică o permite, în medii cu acces restricționat (de regulă fără link-uri publice directe). Detalii despre acces limitat din motive de siguranță și conformitate sunt la secțiunea „Siguranță, raportări și conformitate legală”.",
      "Vă rugăm să nu trimiteți conținut ilegal, care încalcă drepturile altora, care vizează minori în mod inacceptabil sau care lezează viața privată a terților fără temei. Sunteți responsabil pentru conținutul pe care îl transmiteți.",
    ],
  },
  {
    title: "Apeluri audio și video (cameră și microfon)",
    content: [
      "Pentru funcția de apel audio și apel video între utilizatori, aplicația poate solicita acces la microfon și, doar pentru apelurile video, la cameră (camera dispozitivului), prin mecanismele de permisiuni oferite de browser sau de sistemul de operare.",
      "Microfonul este folosit exclusiv în timpul unui apel audio sau video activ, pentru a transmite vocea dumneavoastră către celălalt participant. Camera este folosită exclusiv în timpul unui apel video activ, pentru a transmite imaginea către celălalt participant.",
      "Accesul la microfon și la cameră este solicitat și activ doar când inițiați sau acceptați un apel în cadrul aplicației; nu folosim aceste permisiuni în fundal în afara unui apel activ pentru dumneavoastră (fără conectare la canalul de apel, microfonul și camera nu sunt accesate în scopul apelurilor).",
      "Apelurile audio și video NU sunt înregistrate și NU sunt stocate ca fișiere audio sau video pe serverele noastre în scopul salvării convorbirilor. În afara fluxului media, pot fi prelucrate date tehnice minime necesare semnalizării apelului și stării serviciului (ex. apel în așteptare, apel pierdut, identificatori de cameră/sesiune), precum și date reiterate în alte secțiuni ale acestei politici (ex. securitate, autentificare), independent de conținutul vocal sau video al convorbirii.",
    ],
  },
  {
    title: "8. Siguranță, raportări și conformitate legală",
    content: [
      "Pentru siguranța Serviciului, soluționarea raportărilor și respectarea legii, personalul autorizat poate consulta în mod strict limitat conținut relevant din comunicări și atașamente numai când există o bază concretă: raport de încredere, cerință legală valabilă, investigație de securitate sau abuz, ori întreținere tehnică necesară în acel moment. În astfel de situații, consultarea poate privi un volum limitat de mesaje recente, relevante pentru cazul concret (de exemplu între anumite conturi implicate într-o raportare), nu întreaga istorie a conversațiilor. Accesul este proporțional, restrâns la personal autorizat și limitat la ce este necesar în circumstanța respectivă.",
      "Practicile de mai sus nu echivalează cu supravegherea continuă sau cu citirea sistematică a conversațiilor dintre utilizatori pentru alt scop decât cele menționate. Nu folosim conținutul mesajelor în scopuri de publicitate, profilare de marketing sau analiză de marketing asupra conversațiilor.",
      "Anumite acțiuni operaționale și de încredere pot fi jurnalizate în mod proporționat (de exemplu procesarea unui raport sau aplicarea unei măsuri asupra unui cont), pentru audit intern și securitate.",
      "Puteți folosi funcțiile de raportare din aplicație; le analizăm în concordanță cu această politică și cu Termenii.",
    ],
  },
  {
    title: "9. Decizii automate și recomandări",
    content: [
      "Anumite funcții (ex. afișarea profilurilor, ordinea în fluxuri, sugestii) pot folosi logică automată sau algoritmică. Aceasta poate influența modul în care descoperiți alte persoane în cadrul Serviciului.",
      "În măsura în care se aplică legislația relevantă, nu se iau împotriva dvs. decizii cu efect juridic sau similar semnificativ pe baza exclusivă a profilării automate, fără posibilitatea dvs. de a solicita intervenție umană sau de a exprima un punct de vedere.",
    ],
  },
  {
    title: "10. Vârstă minimă",
    content: [
      "Serviciul este destinat exclusiv persoanelor care au împlinit 18 ani. Nu colectăm cu bună știință date de la minori sub această vârstă. Dacă aveți cunoștință despre un astfel de cont, vă rugăm să ne contactați.",
    ],
  },
  {
    title: "11. Modificări ale acestei politici",
    content: [
      "Putem actualiza această Politică de confidențialitate pentru a reflecta schimbări legale, tehnice sau ale Serviciului. Versiunea aplicabilă este cea publicată pe site-ul nostru; vă încurajăm să consultați periodic această pagină. Utilizarea continuă după publicarea modificărilor poate constitui acceptarea acestora, acolo unde legea permite.",
    ],
  },
  {
    title: "12. Contact și operator",
    content: [
      "Identificare publică a operatorului (GDPR / magazine de aplicații): serviciul Diebel (inclusiv aplicația disponibilă la chat.diebel.ro și domeniile asociate) este pus la dispoziție de o persoană juridică cu sediul în România. Țară: România. Denumirea legală completă a societății și Codul Unic de Înregistrare (CUI) (conform Registrului Comerțului / actului constitutiv) sunt comunicate la solicitare la contact@diebel.ro, de regulă în cel mult 30 de zile. Adresa sediului social nu este afișată în această politică publică; dacă o autoritate competentă solicită în mod expres date suplimentare de localizare a operatorului, legea aplicabilă stabilește modalitatea de comunicare. Contact protecția datelor: contact@diebel.ro.",
      "Pentru exercitarea drepturilor GDPR (acces, rectificare, ștergere, restricționare, portabilitate, opoziție, plângere la autoritate) și pentru întrebări privind confidențialitatea: contact@diebel.ro. În România, autoritatea de supraveghere este ANSPDCP (www.dataprotection.ro).",
    ],
  },
];

const privacyEN: LegalSection[] = [
  {
    title: "In short (Diebel & app stores)",
    content: [
      "Diebel is a chat and calling app for adults: messaging, meeting people, and voice or video conversations. This section summarises, for app stores such as Google Play, which types of data may be involved.",
      "User authentication is provided through service-enabled methods or third-party providers, depending on the active configuration. We may process, among other things: account and authentication data (including, where applicable, email and other data supplied in the active authentication flow), the content of messages you send through the service, technical data needed to operate the service (for example device and network information), and data used for push notifications (tokens), to alert you (new messages, calls, etc.) when you allow notifications on your device.",
      "We do not sell or rent your personal data to third parties for their own marketing.",
      "We use data for app functionality and for necessary, aligned purposes: account access, profile, chat, calls, notifications, security, technical maintenance, and compliance with our Terms and applicable law. We do not use message content for advertising, marketing profiling, or marketing analytics on your conversations.",
      "We process only the minimum data required for the Service to function, and data is protected with encryption in transit (HTTPS/TLS) when transmitted between the app and our servers.",
      "For privacy questions or to exercise your rights: contact@diebel.ro. Website: https://chat.diebel.ro. Full details follow below.",
    ],
  },
  {
    title: "1. Data controller",
    content: [
      "The operator of the Diebel service is the controller of your personal data (\"Controller\"). Data is processed in accordance with Regulation (EU) 2016/679 (GDPR) and applicable national law.",
    ],
  },
  {
    title: "2. Data collected",
    content: [
      "We collect: identification data (email, name, date of birth, gender); profile data (bio, preferences, photos, city, education, occupation); communication data (text messages and file attachments sent in the app, including images and documents, within the limits of permitted features); technical data (IP address, device type, browser, and operational technical identifiers — which may include technical signals from your device or browser — used for session delivery, security, abuse prevention, and service operations; not for our own advertising); usage data (in-app actions, matches, visits); and, with your consent, location data (for distance to other users).",
      "Cookies and similar technologies are described in the Cookie Policy on our website.",
    ],
  },
  {
    title: "3. Legal bases",
    content: [
      "We process data on the basis of: (a) consent (marketing, optional cookies, location); (b) contract performance (service delivery, authentication, messaging); (c) legitimate interest (security, fraud prevention, service improvement, aggregated analytics); (d) legal obligation (record retention, response to lawful requests).",
    ],
  },
  {
    title: "4. Your rights (GDPR)",
    content: [
      "You have the right to: access your data; rectification; erasure (\"right to be forgotten\"); restriction of processing; data portability; objection; withdrawal of consent (without affecting the lawfulness of prior processing); and to lodge a complaint with a supervisory authority.",
      "To exercise your rights, contact us at the email address indicated in this Privacy Policy or in the app. You can request access and data portability by contacting us via the support email. You may also delete your account via in-app account settings (password confirmation), where that option is available. We respond within 30 days.",
    ],
  },
  {
    title: "5. Data retention",
    content: [
      "We retain data for as long as necessary for the provision of the service, the contractual relationship and legal obligations. If you delete your account in the app (where the feature is available, with password confirmation), primary data linked to the account is removed from active systems; residual copies in backups or security logs may persist for a limited period before rotation or deletion (typically up to 90 days), except where the law requires longer retention.",
      "Security logs and backups may hold temporary copies; these are rotated and deleted in line with our internal policy.",
    ],
  },
  {
    title: "6. Security and recipients",
    content: [
      "We implement appropriate technical and organisational measures to protect data: communication between the app and our servers is protected in transit (HTTPS/TLS), backend access is restricted, and relevant staff are trained. Specific limits of the infrastructure (including server-side storage) depend on our providers and current configuration.",
      "Operational service providers (hosting, storage, email, notifications, security, etc.) may process data only on our behalf and only to the extent necessary to provide those services.",
      "We do not sell personal data and do not share it with third parties for their independent advertising, profiling, or marketing purposes. We do not transfer data outside the EEA without an appropriate legal basis (adequacy decision, safeguards, standard clauses).",
    ],
  },
  {
    title: "7. Messages, attachments and images in chat",
    content: [
      "Text messages and files you send through the Service (including images, PDFs and other types allowed by the features) are processed to deliver them to recipients, display conversation history, and operate messaging.",
      "Such content may be stored on our infrastructure or that of providers involved in hosting, storage and security, for as long as necessary to provide the Service and in line with our retention section.",
      "We do not systematically access or analyse message content. In limited situations, content may be viewed when necessary for safe operation, technical maintenance, abuse reports, security, or legal compliance. We do not use message content for advertising, marketing profiling, or marketing analytics on your conversations.",
      "Where technically configured, chat attachments are shown to authenticated conversation participants and kept in restricted-access storage (generally not as direct, public URLs). Limited access for safety and compliance is described under \"Safety, reports and legal compliance\".",
      "Do not send illegal content, content that infringes others' rights, content that unlawfully harms minors, or content that violates third parties' privacy. You are responsible for what you send.",
    ],
  },
  {
    title: "Audio and video calls (camera and microphone)",
    content: [
      "For audio and video calls between users, the application may request access to the microphone and, for video calls only, to the camera (your device's camera) through the permission mechanisms provided by your browser or operating system.",
      "The microphone is used only during an active audio or video call to transmit your voice to the other participant. The camera is used only during an active video call to transmit your image to the other participant.",
      "Microphone and camera access is requested and active only when you start or accept a call within the application; we do not use these permissions in the background outside of a call that is active for you (without connecting to the call channel, the microphone and camera are not accessed for calling purposes).",
      "Audio and video calls are NOT recorded and are NOT stored as audio or video files on our servers for the purpose of saving the conversation. Outside the media stream, we may process minimal technical data needed for call signalling and service state (e.g. pending or missed-call records, room/session identifiers), as well as data described elsewhere in this Policy (e.g. security, authentication), independently of the voice or video content of the call.",
    ],
  },
  {
    title: "8. Safety, reports and legal compliance",
    content: [
      "To operate the Service safely, handle user reports, and comply with the law, authorised staff may review a strictly limited slice of relevant communications or attachments only when there is a concrete basis: a trusted report, valid legal requirement, security or abuse investigation, or necessary technical maintenance in that context. In those situations, review may cover a limited set of recent messages relevant to the specific case (for example between particular accounts involved in a report), not the full conversation history. Access is proportionate, limited to authorised personnel, and narrowly scoped to what is needed.",
      "These practices are not continuous monitoring and are not systematic reading of conversations for unrelated purposes. We do not use message content for advertising, marketing profiling, or marketing analytics on your conversations.",
      "Certain operational and trust-and-safety actions may be logged in a proportionate way (for example processing a report or applying an account measure), for internal audit and security.",
      "You can use in-app reporting; we handle reports in line with this Policy and the Terms.",
    ],
  },
  {
    title: "9. Automated decisions and recommendations",
    content: [
      "Some features (e.g. profile display, feed ordering, suggestions) may use automated or algorithmic logic. This may affect how you discover other people within the Service.",
      "Where applicable law requires, we do not make decisions with significant legal or similar effects concerning you based solely on automated profiling, without your right to request human review or express your point of view.",
    ],
  },
  {
    title: "10. Minimum age",
    content: [
      "The Service is intended solely for people aged 18 or over. We do not knowingly collect data from children below that age. If you become aware of such an account, please contact us.",
    ],
  },
  {
    title: "11. Changes to this policy",
    content: [
      "We may update this Privacy Policy to reflect legal, technical or Service changes. The applicable version is the one published on our website; we encourage you to review this page periodically. Continued use after changes are published may constitute acceptance where the law allows.",
    ],
  },
  {
    title: "12. Contact and controller",
    content: [
      "Public identification of the controller (GDPR / app stores): the Diebel service (including the application available at chat.diebel.ro and associated domains) is provided by a legal entity registered in Romania. Country: Romania. The full legal name of the company and Unique Registration Code (CUI) (as shown in the Trade Register / constitutional documents) will be provided on request at contact@diebel.ro, typically within 30 days. The registered office address is not displayed in this public policy; if a competent authority expressly requests additional information to locate the controller, applicable law governs how it is provided. Data protection contact: contact@diebel.ro.",
      "To exercise GDPR rights (access, rectification, erasure, restriction, portability, objection, complaint to a supervisory authority) and for privacy questions: contact@diebel.ro. In Romania, the supervisory authority is ANSPDCP (www.dataprotection.ro).",
    ],
  },
];

const privacyDE: LegalSection[] = [
  {
    title: "Kurz gefasst (Diebel & App Stores)",
    content: [
      "Diebel ist eine Chat- und Anruf-App für Erwachsene: Nachrichten, Kennenlernen sowie Sprach- oder Videoanrufe. Dieser Abschnitt fasst für App Stores wie Google Play zusammen, welche Arten von Daten betroffen sein können.",
      "Die Authentifizierung erfolgt über vom Dienst bereitgestellte Methoden oder Drittanbieter, abhängig von der aktiven Konfiguration. Verarbeitet werden können unter anderem: Kontodaten und Authentifizierungsdaten (einschließlich ggf. E-Mail und weiterer Angaben im jeweils aktiven Anmeldevorgang), Inhalte von Nachrichten, die du über den Dienst sendest, technische Daten für den Betrieb (z. B. Gerät, Netzwerk) sowie Daten für Push-Benachrichtigungen (Tokens), um dich zu informieren (neue Nachrichten, Anrufe usw.), wenn du Benachrichtigungen auf dem Gerät erlaubst.",
      "Wir verkaufen oder vermieten deine personenbezogenen Daten nicht an Dritte zu deren eigenen Marketingzwecken.",
      "Wir nutzen Daten für App-Funktionen und für notwendige, damit vereinbare Zwecke: Konto, Profil, Chat, Anrufe, Benachrichtigungen, Sicherheit, technische Wartung sowie Einhaltung unserer Nutzungsbedingungen und des geltenden Rechts. Wir verwenden Nachrichteninhalte nicht für Werbung, Marketing-Profiling oder Marketing-Analytics über deine Gespräche.",
      "Wir verarbeiten nur die für den Betrieb des Dienstes mindestens erforderlichen Daten; Daten werden bei der Übertragung zwischen App und Servern durch Verschlüsselung (HTTPS/TLS) geschützt.",
      "Fragen zum Datenschutz oder zur Ausübung deiner Rechte: contact@diebel.ro. Website: https://chat.diebel.ro. Ausführliche Informationen folgen unten.",
    ],
  },
  {
    title: "1. Verantwortlicher",
    content: [
      "Der Betreiber des Dienstes Diebel ist Verantwortlicher für die Verarbeitung Ihrer personenbezogenen Daten (\"Verantwortlicher\"). Die Verarbeitung erfolgt gemäß der Verordnung (EU) 2016/679 (DSGVO) und dem anwendbaren nationalen Recht.",
    ],
  },
  {
    title: "2. Erhobene Daten",
    content: [
      "Wir erheben: Identifikationsdaten (E-Mail, Name, Geburtsdatum, Geschlecht); Profildaten (Beschreibung, Präferenzen, Fotos, Stadt, Bildung, Beruf); Kommunikationsdaten (Textnachrichten und Dateianhänge in der App, einschließlich Bilder und Dokumente, innerhalb der erlaubten Funktionen); technische Daten (IP-Adresse, Gerätetyp, Browser und operative technische Kennungen — können technische Signale von Gerät oder Browser umfassen — für Sitzung, Sicherheit, Missbrauchsbekämpfung und Betrieb des Dienstes; nicht für eigene Werbung); Nutzungsdaten (Aktionen in der App, Matches, Besuche); und mit Ihrer Einwilligung Standortdaten (für die Entfernung zu anderen Nutzern).",
      "Cookies und ähnliche Technologien werden in der Cookie-Richtlinie auf unserer Website beschrieben.",
    ],
  },
  {
    title: "3. Rechtsgrundlagen",
    content: [
      "Wir verarbeiten Daten auf Grundlage von: (a) Einwilligung (Marketing, optionale Cookies, Standort); (b) Vertragserfüllung (Dienstleistung, Authentifizierung, Messaging); (c) berechtigtem Interesse (Sicherheit, Betrugsprävention, Verbesserung des Dienstes, aggregierte Analysen); (d) gesetzlicher Verpflichtung (Aufbewahrung, Reaktion auf rechtmäßige Anfragen).",
    ],
  },
  {
    title: "4. Ihre Rechte (DSGVO)",
    content: [
      "Sie haben das Recht auf: Auskunft; Berichtigung; Löschung („Recht auf Vergessenwerden“); Einschränkung der Verarbeitung; Datenübertragbarkeit; Widerspruch; Widerruf der Einwilligung (ohne Beeinträchtigung der Rechtmäßigkeit der bisherigen Verarbeitung); und Beschwerde bei einer Aufsichtsbehörde.",
      "Zur Ausübung Ihrer Rechte kontaktieren Sie uns unter der in dieser Datenschutzrichtlinie oder in der App angegebenen E-Mail-Adresse. Sie können Auskunft und Datenübertragbarkeit per Anfrage an die Support‑E‑Mail anfordern. Sie können Ihr Konto auch über die Kontoeinstellungen in der App löschen (mit Passwortbestätigung), soweit diese Funktion verfügbar ist. Wir antworten innerhalb von 30 Tagen.",
    ],
  },
  {
    title: "5. Aufbewahrung",
    content: [
      "Wir speichern Daten so lange, wie für die Erbringung des Dienstes, die Vertragsbeziehung und gesetzliche Verpflichtungen erforderlich. Wenn Sie Ihr Konto in der App löschen (soweit verfügbar, mit Passwortbestätigung), werden die wesentlichen mit dem Konto verbundenen Daten aus den aktiven Systemen entfernt; Restkopien in Backups oder Sicherheitsprotokollen können vor Rotation oder Löschung eine begrenzte Zeit bestehen (in der Regel bis zu 90 Tage), sofern das Gesetz keine längere Aufbewahrung vorschreibt.",
      "Sicherheitsprotokolle und Backups können vorübergehende Kopien enthalten; diese werden gemäß unserer internen Richtlinie rotiert und gelöscht.",
    ],
  },
  {
    title: "6. Sicherheit und Empfänger",
    content: [
      "Wir setzen angemessene technische und organisatorische Maßnahmen zum Schutz der Daten ein: Die Kommunikation zwischen App und Servern ist in der Übertragung geschützt (HTTPS/TLS), der Backend-Zugriff ist eingeschränkt, und relevantes Personal wird geschult. Spezifische Grenzen der Infrastruktur (einschließlich serverseitiger Speicherung) hängen von unseren Anbietern und der aktuellen Konfiguration ab.",
      "Betrieblich tätige Auftragsverarbeiter (Hosting, Speicherung, E-Mail, Benachrichtigungen, Sicherheit usw.) dürfen Daten nur in unserem Auftrag und nur soweit verarbeiten, wie dies zur Erbringung dieser Dienste erforderlich ist.",
      "Wir verkaufen keine personenbezogenen Daten und geben sie nicht an Dritte für deren eigene Werbung, Profiling- oder Marketingzwecke weiter. Wir übermitteln keine Daten außerhalb des EWR ohne geeignete Rechtsgrundlage (Angemessenheitsbeschluss, Garantien, Standardklauseln).",
    ],
  },
  {
    title: "7. Nachrichten, Anhänge und Bilder im Chat",
    content: [
      "Textnachrichten und Dateien, die Sie über den Dienst senden (einschließlich Bilder, PDFs und anderer erlaubter Typen), werden verarbeitet, um sie Empfängern zuzustellen, den Verlauf anzuzeigen und den Nachrichtenaustausch zu ermöglichen.",
      "Solche Inhalte können auf unserer Infrastruktur oder der von Anbietern für Hosting, Speicherung und Sicherheit gespeichert werden, solange dies für den Dienst erforderlich ist und gemäß unserem Abschnitt zur Aufbewahrung.",
      "Wir greifen nicht systematisch auf Nachrichteninhalte zu und analysieren sie nicht systematisch. In begrenzten Fällen können Inhalte eingesehen werden, wenn dies für sicheren Betrieb, technische Wartung, Missbrauchsmeldungen, Sicherheit oder rechtliche Compliance erforderlich ist. Wir verwenden Nachrichteninhalte nicht für Werbung, Marketing-Profiling oder Marketing-Analytics über Ihre Gespräche.",
      "Soweit technisch eingerichtet, sind Chat-Anhänge für authentifizierte Gesprächsteilnehmer sichtbar und in regelmäßig eingeschränkt zugänglicher Speicherung abgelegt (in der Regel ohne direkte öffentliche URLs). Begrenzter Zugriff aus Gründen der Sicherheit und Compliance ist unter \"Sicherheit, Meldungen und rechtliche Compliance\" beschrieben.",
      "Senden Sie keine illegalen Inhalte, keine rechtsverletzenden Inhalte, keine Inhalte, die Minderjährige in unzulässiger Weise betreffen, und keine Inhalte, die die Privatsphäre Dritter verletzen. Sie sind für Ihre gesendeten Inhalte verantwortlich.",
    ],
  },
  {
    title: "Audio- und Videoanrufe (Kamera und Mikrofon)",
    content: [
      "Für Audio- und Videoanrufe zwischen Nutzern kann die Anwendung Zugriff auf das Mikrofon und - nur bei Videoanrufen - auf die Kamera (Gerätekamera) über die Berechtigungsmechanismen Ihres Browsers oder Betriebssystems anfordern.",
      "Das Mikrofon wird ausschließlich während eines aktiven Audio- oder Videoanrufs verwendet, um Ihre Stimme an den anderen Teilnehmer zu übertragen. Die Kamera wird ausschließlich während eines aktiven Videoanrufs verwendet, um Ihr Bild an den anderen Teilnehmer zu übertragen.",
      "Der Zugriff auf Mikrofon und Kamera wird nur angefordert und aktiv, wenn Sie einen Anruf starten oder annehmen; wir nutzen diese Berechtigungen nicht im Hintergrund außerhalb eines für Sie aktiven Anrufs (ohne Verbindung zum Anrufkanal werden Mikrofon und Kamera nicht für Anrufzwecke genutzt).",
      "Audio- und Videoanrufe werden NICHT aufgezeichnet und NICHT als Audio- oder Videodateien auf unseren Servern gespeichert, um Gespräche zu archivieren. Außerhalb des Medienstroms können minimale technische Daten für Signalisierung und Anrufstatus (z. B. ausstehende oder verpasste Anrufe, Raum-/Sitzungskennungen) sowie in anderen Abschnitten dieser Richtlinie beschriebene Daten (z. B. Sicherheit, Authentifizierung) verarbeitet werden, unabhängig vom Sprach- oder Videoinhalt.",
    ],
  },
  {
    title: "8. Sicherheit, Meldungen und rechtliche Compliance",
    content: [
      "Zur sicheren Bereitstellung des Dienstes, zur Bearbeitung von Meldungen und zur Einhaltung des Rechts dürfen autorisierte Mitarbeitende nur unter strikter Begrenzung einschlägige Kommunikations- oder Anhangsinhalte einsehen, wenn ein konkreter Anlass besteht: vertrauenswürdige Meldung, gültige rechtliche Anforderung, Sicherheits- oder Missbrauchsuntersuchung oder in diesem Zusammenhang erforderliche technische Wartung. In solchen Fällen kann die Prüfung auf eine begrenzte Anzahl aktueller, für den konkreten Fall relevanter Nachrichten beschränkt sein (z. B. zwischen bestimmten Konten im Zusammenhang mit einer Meldung), nicht auf den gesamten Chatverlauf. Der Zugriff ist verhältnismäßig, auf autorisierte Personen beschränkt und eng am Bedarf ausgerichtet.",
      "Dies bedeutet keine kontinuierliche Überwachung und keine systematische Durchsicht von Gesprächen zu anderen Zwecken. Wir verwenden Nachrichteninhalte nicht für Werbung, Marketing-Profiling oder Marketing-Analytics über Ihre Gespräche.",
      "Bestimmte betriebliche und vertrauens- und sicherheitsrelevante Handlungen können verhältnismäßig protokolliert werden (z. B. Bearbeitung einer Meldung oder Anwendung einer Kontomaßnahme), für interne Revision und Sicherheit.",
      "Sie können die Meldefunktionen in der App nutzen; wir bearbeiten Meldungen gemäß dieser Richtlinie und den Bedingungen.",
    ],
  },
  {
    title: "9. Automatisierte Entscheidungen und Empfehlungen",
    content: [
      "Einige Funktionen (z. B. Profilanzeige, Feed-Reihenfolge, Vorschläge) können automatisierte oder algorithmische Logik nutzen. Dies kann beeinflussen, wie Sie andere Personen im Dienst entdecken.",
      "Soweit anwendbares Recht dies vorschreibt, treffen wir keine Entscheidungen mit erheblicher rechtlicher oder ähnlicher Wirkung für Sie ausschließlich auf der Grundlage automatisierter Profilbildung, ohne dass Sie menschliche Prüfung oder Stellungnahme verlangen können.",
    ],
  },
  {
    title: "10. Mindestalter",
    content: [
      "Der Dienst richtet sich ausschließlich an Personen ab 18 Jahren. Wir erheben wissentlich keine Daten von Kindern unter diesem Alter. Wenn Sie von einem solchen Konto erfahren, kontaktieren Sie uns bitte.",
    ],
  },
  {
    title: "11. Änderungen dieser Richtlinie",
    content: [
      "Wir können diese Datenschutzrichtlinie aktualisieren, um rechtliche, technische oder dienstliche Änderungen widerzuspiegeln. Die maßgebliche Fassung ist die auf unserer Website veröffentlichte; wir empfehlen regelmäßiges Nachlesen. Die fortgesetzte Nutzung nach Veröffentlichung von Änderungen kann, soweit das Recht es zulässt, als Zustimmung gelten.",
    ],
  },
  {
    title: "12. Kontakt und Verantwortlicher",
    content: [
      "Öffentliche Identifizierung des Verantwortlichen (DSGVO / App-Stores): Der Dienst Diebel (einschließlich der Anwendung unter chat.diebel.ro und zugehöriger Domains) wird von einer in Rumänien ansässigen juristischen Person bereitgestellt. Land: Rumänien. Der vollständige Firmenname und die eindeutige Steuernummer (CUI) (gemäß Handelsregister / Gründungsurkunde) werden auf Anfrage an contact@diebel.ro mitgeteilt, in der Regel innerhalb von 30 Tagen. Die Adresse des eingetragenen Sitzes wird in dieser öffentlichen Datenschutzerklärung nicht angezeigt; wenn eine zuständige Behörde ausdrücklich zusätzliche Angaben zur Lokalisierung des Verantwortlichen verlangt, regelt das anwendbare Recht die Übermittlung. Kontakt Datenschutz: contact@diebel.ro.",
      "Zur Ausübung Ihrer DSGVO-Rechte (Auskunft, Berichtigung, Löschung, Einschränkung, Übertragbarkeit, Widerspruch, Beschwerde bei einer Aufsichtsbehörde) und für Datenschutzfragen: contact@diebel.ro. In Rumänien ist die Aufsichtsbehörde die ANSPDCP (www.dataprotection.ro).",
    ],
  },
];

const cookiesRO: LegalSection[] = [
  {
    title: "1. Ce sunt cookie-urile",
    content: [
      "Cookie-urile sunt fișiere mici salvate pe dispozitiv când folosiți site-ul nostru sau aceeași experiență deschisă din aplicații web / PWA / Trusted Web Activity (de ex. din Google Play). Respectăm GDPR și, acolo unde este relevantă, legislația privind cookie-urile.",
    ],
  },
  {
    title: "2. Categorii",
    content: [
      "Necesare: autentificare, securitate și funcții esențiale. Nu necesită consimțământ separat.",
      "Funcționale: preferințe (ex. limbă). Activează doar dacă le accepți în banner.",
      "Statistici (opțional): după ce accepți categoria în banner, pot fi încărcate instrumente de analiză agregată — de ex. Google Analytics 4 — numai dacă operatorul a configurat identificatorii tehnici în mediul de producție (variabile de mediu). Scopurile sunt măsurare și îmbunătățire (audieneță, performanță generală a serviciului), nu analiza conținutului mesajelor din chat. Nu folosim aceste instrumente pentru a citi mesajele private din chat.",
      "Marketing / măsurători reclame (opțional): după acord explicit, pot fi încărcate tehnologii precum Meta Pixel sau scripturi Google Ads — numai dacă sunt configurate în mediul de producție (variabile de mediu) și după acceptul tău în banner. Nu rulează implicit la deschiderea aplicației.",
    ],
  },
  {
    title: "3. Cum funcționează pe web și în variante instalate (TWA)",
    content: [
      "Diebel în browser, ca PWA instalată sau prin cochilie TWA (ex. Google Play) folosește același site. Serviciile terțe de statistici și marketing de mai sus nu pornesc automat: se încarcă doar după ce selectezi categoriile în bannerul de cookie-uri și doar în măsura în care identificatorii respectivi sunt configurați pentru serviciul live. Detalii despre prelucrarea datelor prin Serviciu sunt și în Politica de confidențialitate.",
    ],
  },
  {
    title: "4. Gestionarea preferințelor",
    content: [
      "Puteți schimba preferințele oricând prin butonul „Setări cookies” din site. Consimțământul este stocat local (localStorage) și respectat la vizitele ulterioare. Puteți șterge cookie-urile din setările browserului; unele funcții ale site-ului ar putea fi afectate.",
    ],
  },
  {
    title: "5. Contact",
    content: [
      "Pentru orice solicitare legată de datele tale personale (inclusiv ștergerea contului — și prin Setările contului din aplicație, unde este disponibil — rectificare sau întrebări privind confidențialitatea), ne poți contacta la contact@diebel.ro. Poți solicita acces și portabilitate a datelor printr-o solicitare la emailul de contact. Vom răspunde în cel mai scurt timp posibil, în conformitate cu legislația aplicabilă.",
      "Site web oficial al serviciului: https://chat.diebel.ro",
    ],
  },
];

const cookiesEN: LegalSection[] = [
  {
    title: "1. What cookies are",
    content: [
      "Cookies are small files stored on your device when you use our website or the same experience opened from a web app, PWA, or Trusted Web Activity shell (e.g. from Google Play). We comply with the GDPR and, where relevant, cookie and privacy rules.",
    ],
  },
  {
    title: "2. Categories",
    content: [
      "Necessary: authentication, security, and core features. No separate consent required.",
      "Functional: preferences (e.g. language). Enabled only if you accept them in the banner.",
      "Statistics (optional): after you opt in, aggregated analytics tools — e.g. Google Analytics 4 — may load only if the operator has configured the relevant environment variables in production. Purposes include measurement and improvement (audience insight, general service performance), not analysis of chat message content. They are not used to read your private chat messages.",
      "Marketing / ad measurement (optional): after explicit consent, technologies such as Meta Pixel or Google Ads scripts may load only if configured in production via environment variables and after you accept the category in the banner. They do not run by default when you open the app.",
    ],
  },
  {
    title: "3. Web and installed (TWA) use",
    content: [
      "Diebel in the browser, as an installed PWA, or inside a TWA (e.g. Google Play) uses the same site. Third-party statistics and marketing tools above do not start automatically: they load only after you choose categories in the cookie banner and only when the corresponding IDs are configured for the live service. How we process personal data in the Service is also described in the Privacy Policy.",
    ],
  },
  {
    title: "4. Managing preferences",
    content: [
      "You can change your preferences at any time via the \"Cookie settings\" button on the site. Consent is stored locally (localStorage) and honoured on subsequent visits. You can delete cookies in your browser settings; some site features may be affected.",
    ],
  },
  {
    title: "5. Contact",
    content: [
      "For any request related to your personal data (including account deletion — also via in-app account settings where available — rectification, or privacy questions), you can contact us at contact@diebel.ro. You can request access and data portability by contacting us via the support email. We will respond as soon as possible in accordance with applicable data protection laws.",
      "Official service website: https://chat.diebel.ro",
    ],
  },
];

const cookiesDE: LegalSection[] = [
  {
    title: "1. Was sind Cookies",
    content: [
      "Cookies sind kleine Dateien auf Ihrem Gerät, wenn Sie unsere Website oder dieselbe Anwendung als Web-App, PWA oder in einer Trusted-Web-Activity-Hülle (z. B. aus Google Play) nutzen. Wir beachten die DSGVO und, soweit einschlägig, Cookie- und Datenschutzregeln.",
    ],
  },
  {
    title: "2. Kategorien",
    content: [
      "Notwendig: Authentifizierung, Sicherheit und Kernfunktionen. Keine separate Einwilligung erforderlich.",
      "Funktional: Einstellungen (z. B. Sprache). Nur aktiv, wenn Sie sie im Banner akzeptieren.",
      "Statistik (optional): Nach Ihrer Einwilligung können aggregierte Analysetools — z. B. Google Analytics 4 — nur geladen werden, wenn der Betreiber die entsprechenden Kennungen per Umgebungsvariablen in Produktion konfiguriert hat. Zweck sind Messung und Verbesserung (Einblicke in die Reichweite, allgemeine Leistung des Dienstes), nicht die Auswertung von Chat-Inhalten. Sie dienen nicht zum Lesen Ihrer privaten Chat-Nachrichten.",
      "Marketing / Werbemessung (optional): Nach ausdrücklicher Einwilligung können z. B. Meta Pixel oder Google-Ads-Skripte nur geladen werden, wenn sie in Produktion per Umgebungsvariablen konfiguriert sind und nach Akzeptanz im Banner. Sie starten nicht automatisch beim Öffnen der App.",
    ],
  },
  {
    title: "3. Web und installierte Nutzung (TWA)",
    content: [
      "Diebel im Browser, als installierte PWA oder in einer TWA (z. B. Google Play) nutzt dieselbe Website. Drittanbieter-Statistik und -Marketing starten nicht automatisch: Sie werden erst nach Ihrer Auswahl im Cookie-Banner geladen und nur, wenn die jeweiligen Kennungen für den Live-Dienst konfiguriert sind. Die Verarbeitung personenbezogener Daten im Dienst ist außerdem in der Datenschutzrichtlinie beschrieben.",
    ],
  },
  {
    title: "4. Präferenzen verwalten",
    content: [
      "Sie können Ihre Präferenzen jederzeit über den Button „Cookie-Einstellungen“ auf der Website ändern. Die Einwilligung wird lokal (localStorage) gespeichert und bei späteren Besuchen berücksichtigt. Sie können Cookies in den Browsereinstellungen löschen; einige Funktionen der Website können beeinträchtigt werden.",
    ],
  },
  {
    title: "5. Kontakt",
    content: [
      "Für alle Anfragen im Zusammenhang mit Ihren personenbezogenen Daten (einschließlich Kontolöschung — auch über die Kontoeinstellungen in der App, soweit verfügbar — Berichtigung oder Fragen zum Datenschutz) können Sie uns unter contact@diebel.ro erreichen. Sie können Auskunft und Datenübertragbarkeit per Anfrage an die Support‑E‑Mail anfordern. Wir beantworten Ihre Anfrage so schnell wie möglich gemäß den geltenden Datenschutzgesetzen.",
      "Offizielle Website des Dienstes: https://chat.diebel.ro",
    ],
  },
];

const byLocale = {
  ro: { terms: termsRO, privacy: privacyRO, cookies: cookiesRO },
  en: { terms: termsEN, privacy: privacyEN, cookies: cookiesEN },
  de: { terms: termsDE, privacy: privacyDE, cookies: cookiesDE },
} as const;

export function getTermsContent(locale: Locale): LegalSection[] {
  return byLocale[locale].terms;
}

export function getPrivacyContent(locale: Locale): LegalSection[] {
  return byLocale[locale].privacy;
}

export function getCookiesContent(locale: Locale): LegalSection[] {
  return byLocale[locale].cookies;
}
