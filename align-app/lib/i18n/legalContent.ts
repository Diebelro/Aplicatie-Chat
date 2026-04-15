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
      "Păstrăm dreptul de a modera conținutul și de a elimina materiale care contravin politicilor, fără obligația prealabilă de a notifica în toate cazurile legale.",
      "Detalii despre modul în care sunt prelucrate mesajele, fișierele și imaginile din chat, inclusiv situațiile în care personalul autorizat poate accesa astfel de conținut, sunt descrise în Politica de confidențialitate, disponibilă la adresa publică a site-ului.",
    ],
  },
  {
    title: "4. Moderare, securitate și cooperare cu autoritățile",
    content: [
      "Ne rezervăm dreptul de a examina, modera, restricționa, ascunde sau șterge orice conținut (inclusiv mesaje text, imagini, fișiere atașate și profiluri) atunci când considerăm necesar pentru: aplicarea acestor Termeni și a politicilor; protecția siguranței utilizatorilor; prevenirea fraudelor și abuzurilor; respectarea obligațiilor legale.",
      "Accesul conținutului de către personalul nostru autorizat se face în mod proporțional, în scopurile de mai sus, conform Politicii de confidențialitate (inclusiv în cazul raportărilor, al cererilor legale valabile sau al investigării încălcărilor).",
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
      "Pentru orice solicitare legată de datele tale personale (inclusiv ștergerea contului, exportul datelor, rectificare sau întrebări privind confidențialitatea), ne poți contacta la contact@diebel.ro. Vom răspunde în cel mai scurt timp posibil, în conformitate cu legislația aplicabilă.",
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
      "We reserve the right to moderate content and remove material that violates our policies, without prior notice in all cases where the law so allows.",
      "How messages, files and images in chat are processed, including when authorised staff may access such content, is described in the Privacy Policy published on our website.",
    ],
  },
  {
    title: "4. Moderation, security and cooperation with authorities",
    content: [
      "We reserve the right to review, moderate, restrict, hide or delete any content (including text messages, images, attachments and profiles) when we consider it necessary to: enforce these Terms and our policies; protect user safety; prevent fraud and abuse; comply with legal obligations.",
      "Access to content by our authorised staff is proportionate and for these purposes, as described in the Privacy Policy (including in the case of reports, valid legal requests or investigations of breaches).",
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
      "For any request related to your personal data (including account deletion, data export, rectification, or privacy questions), you can contact us at contact@diebel.ro. We will respond as soon as possible in accordance with applicable data protection laws.",
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
      "Wir behalten uns vor, Inhalte zu moderieren und Material zu entfernen, das gegen unsere Richtlinien verstößt, ohne in allen gesetzlich zulässigen Fällen vorherige Benachrichtigung.",
      "Wie Nachrichten, Dateien und Bilder im Chat verarbeitet werden, einschließlich der Fälle, in denen autorisiertes Personal auf solche Inhalte zugreifen kann, ist in der auf unserer Website veröffentlichten Datenschutzrichtlinie beschrieben.",
    ],
  },
  {
    title: "4. Moderation, Sicherheit und Behördenzusammenarbeit",
    content: [
      "Wir behalten uns vor, Inhalte (einschließlich Textnachrichten, Bilder, Anhänge und Profile) zu prüfen, zu moderieren, einzuschränken, auszublenden oder zu löschen, wenn dies zur Durchsetzung dieser Bedingungen und unserer Richtlinien, zum Schutz der Nutzersicherheit, zur Betrugs- und Missbrauchsbekämpfung oder zur Einhaltung gesetzlicher Pflichten erforderlich ist.",
      "Der Zugriff auf Inhalte durch unser autorisiertes Personal erfolgt verhältnismäßig und zu diesen Zwecken gemäß der Datenschutzrichtlinie (einschließlich bei Meldungen, gültigen rechtlichen Anfragen oder Untersuchungen von Verstößen).",
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
      "Für alle Anfragen im Zusammenhang mit Ihren personenbezogenen Daten (einschließlich Kontolöschung, Datenexport, Berichtigung oder Fragen zum Datenschutz) können Sie uns unter contact@diebel.ro erreichen. Wir beantworten Ihre Anfrage so schnell wie möglich gemäß den geltenden Datenschutzgesetzen.",
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
      "Pot fi prelucrate, printre altele: date de cont (adresă de email; dacă te autentifici cu Google, și informațiile furnizate de Google, de exemplu identificator și email; dacă folosești fluxuri cu SMS sau telefon — numărul de telefon asociat acelui flux), conținutul mesajelor trimise în serviciu, date tehnice necesare funcționării (de exemplu dispozitiv, rețea) și informații pentru notificări push (tokenuri), folosite pentru alerte (mesaje noi, apeluri etc.) când permiți notificările pe dispozitiv.",
      "Nu vindem și nu închiriem datele tale personale către terți în scopuri comerciale ale acestora.",
      "Folosim datele pentru a furniza și securiza serviciul (autentificare, profil, chat, apeluri, notificări), îmbunătățiri rezonabile ale produsului și conformitate cu Termenii și legea aplicabilă.",
      "Pentru întrebări despre date sau exercitarea drepturilor: contact@diebel.ro. Detaliile complete urmează mai jos.",
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
      "Colectăm: date de identificare (email, nume, dată nașterii, gen); date de profil (descriere, preferințe, poze, oraș, educație, ocupație); date de comunicare (mesaje trimise în aplicație); date tehnice (adresă IP, tip dispozitiv, browser, fingerprint); date de utilizare (acțiuni în aplicație, potriviri, vizite); și, cu acordul dvs., date de locație (pentru distanță față de alți utilizatori).",
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
      "Pentru exercitarea drepturilor, contactați-ne la adresa de email indicată în Politica de Confidențialitate sau în aplicație. Răspundem în termen de 30 de zile.",
    ],
  },
  {
    title: "5. Păstrarea datelor",
    content: [
      "Păstrăm datele atât cât este necesar pentru furnizarea serviciului, relația contractuală și obligațiile legale. După ștergerea contului, datele sunt anonimizate sau șterse în termen de 90 de zile, cu excepția celor care trebuie păstrate legal (ex. facturi).",
      "Logurile de securitate și backup-urile pot conține copii temporare; acestea sunt rotite și șterse conform politicii interne.",
    ],
  },
  {
    title: "6. Securitate și destinatari",
    content: [
      "Aplicăm măsuri tehnice și organizatorice adecvate (criptare, acces restricționat, formare) pentru a proteja datele. Datele pot fi transmise către furnizori de servicii (găzduire, email, analitică) care sunt obligați contractual și, unde este cazul, prin clauze contractuale standard.",
      "Nu vindem datele cu caracter personal. Nu transferăm date în afara SEE fără baza legală adecvată (decizie de adecvare, garanții, clauze standard).",
    ],
  },
  {
    title: "7. Mesaje, fișiere atașate și imagini în chat",
    content: [
      "Mesajele text și fișierele pe care le trimiteți prin Serviciu (inclusiv imagini, documente PDF și alte tipuri permise de funcționalitate) sunt prelucrate pentru a le transmite destinatarilor, pentru a afișa istoricul conversației și pentru a permite funcționarea mesageriei.",
      "Acest conținut poate fi stocat pe infrastructura noastră sau a furnizorilor implicați în găzduire, stocare și securitate, pe durata necesară furnizării serviciului și în concordanță cu secțiunea privind păstrarea datelor.",
      "Imaginile și PDF-urile din chat sunt, în măsura permisă de configurația tehnică actuală, păstrate în stocare cu acces restricționat (nu sunt distribuite utilizatorilor ca link-uri publice directe, în mod obișnuit). Vizualizarea în aplicație se face prin mecanisme care verifică autentificarea: participanții la conversație își pot vedea atașamentele în cadrul Serviciului; personalul administrativ autorizat poate avea acces în condițiile descrise la secțiunea privind moderarea și accesul autorizat. Conținutul mai vechi sau cazuri excepționale pot diferi tehnic; ne străduim să aliniem practica la această descriere.",
      "Vă rugăm să nu trimiteți conținut ilegal, care încalcă drepturile altora, care vizează minori în mod inacceptabil sau care lezează viața privată a terților fără temei. Sunteți responsabil pentru conținutul pe care îl transmiteți.",
    ],
  },
  {
    title: "8. Moderare, acces autorizat și cooperare cu autoritățile",
    content: [
      "În scopul siguranței platformei, prevenirii abuzurilor, investigării încălcărilor și respectării legii, personalul tehnic și de încredere autorizat poate accesa conținutul comunicărilor și al fișierelor transmise prin Serviciu (inclusiv mesaje și imagini) în mod proporțional și limitat la ce este necesar.",
      "Accesul poate avea loc în special, fără a se limita la: existența unei raportări sau plângeri; suspiciune rezonabilă de încălcare a Termenilor sau a legii; protejarea drepturilor, securității sau vieții private ale utilizatorilor; cereri legale valabile sau obligații legale (inclusiv solicitări de la autorități publice competente, în condițiile legii aplicabile).",
      "Nu efectuăm monitorizare generală sau sistematică a tuturor conversațiilor în scopuri comerciale care nu țin de siguranță, moderare sau conformitate. Accesul este restricționat la persoane autorizate; anumite acțiuni administrative pot fi înregistrate în jurnale interne (ex. acces la conversații din panoul de administrare, acțiuni de ban).",
      "Puteți folosi funcțiile de raportare din aplicație; analizăm rapoartele în concordanță cu această politică și cu Termenii.",
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
      "Pentru exercitarea drepturilor GDPR (acces, rectificare, ștergere, restricționare, portabilitate, opoziție, plângere la autoritate) și pentru întrebări privind confidențialitatea: contact@diebel.ro. În România, autoritatea de supraveghere este ANSPDCP (www.dataprotection.ro). Datele de identificare completă ale operatorului (denumire, adresă) pot fi comunicate la cerere pe calea indicată mai sus.",
    ],
  },
];

const privacyEN: LegalSection[] = [
  {
    title: "In short (Diebel & app stores)",
    content: [
      "Diebel is a chat and calling app for adults: messaging, meeting people, and voice or video conversations. This section summarises, for app stores such as Google Play, which types of data may be involved.",
      "We may process, among other things: account data (email address; if you sign in with Google, information from Google such as identifier and email; if you use SMS or phone flows — the phone number used in that flow), the content of messages you send through the service, technical data needed to operate the service (for example device and network information), and data used for push notifications (tokens), to alert you (new messages, calls, etc.) when you allow notifications on your device.",
      "We do not sell or rent your personal data to third parties for their own marketing.",
      "We use data to provide and secure the service (account, profile, chat, calls, notifications), make reasonable product improvements, and comply with our Terms and applicable law.",
      "For privacy questions or to exercise your rights: contact@diebel.ro. Full details follow below.",
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
      "We collect: identification data (email, name, date of birth, gender); profile data (bio, preferences, photos, city, education, occupation); communication data (text messages and file attachments sent in the app, including images and documents, within the limits of permitted features); technical data (IP address, device type, browser, fingerprint); usage data (in-app actions, matches, visits); and, with your consent, location data (for distance to other users).",
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
      "To exercise your rights, contact us at the email address indicated in this Privacy Policy or in the app. We respond within 30 days.",
    ],
  },
  {
    title: "5. Data retention",
    content: [
      "We retain data for as long as necessary for the provision of the service, the contractual relationship and legal obligations. After account deletion, data is anonymised or deleted within 90 days, except where retention is required by law (e.g. invoices).",
      "Security logs and backups may hold temporary copies; these are rotated and deleted in line with our internal policy.",
    ],
  },
  {
    title: "6. Security and recipients",
    content: [
      "We implement appropriate technical and organisational measures (encryption, restricted access, training) to protect data. Data may be disclosed to service providers (hosting, email, analytics) who are contractually bound and, where applicable, by standard contractual clauses.",
      "We do not sell personal data. We do not transfer data outside the EEA without an appropriate legal basis (adequacy decision, safeguards, standard clauses).",
    ],
  },
  {
    title: "7. Messages, attachments and images in chat",
    content: [
      "Text messages and files you send through the Service (including images, PDFs and other types allowed by the features) are processed to deliver them to recipients, display conversation history and operate messaging.",
      "Such content may be stored on our infrastructure or that of providers involved in hosting, storage and security, for as long as necessary to provide the Service and in line with our retention section.",
      "Where technically configured, chat images and PDFs are kept in restricted-access storage and are not routinely exposed to users as direct public URLs. Display in the app relies on technical checks after sign-in: conversation participants can view attachments within the Service; authorised administrative staff may access content as described under moderation and authorised access. Older content or exceptional cases may differ technically; we aim to align practice with this description.",
      "Do not send illegal content, content that infringes others' rights, content that unlawfully harms minors, or content that violates third parties' privacy. You are responsible for what you send.",
    ],
  },
  {
    title: "8. Moderation, authorised access and cooperation with authorities",
    content: [
      "To keep the platform safe, prevent abuse, investigate violations and comply with the law, authorised trusted technical and moderation staff may access the content of communications and files sent through the Service (including messages and images) in a proportionate manner and only as necessary.",
      "Access may occur in particular (without limitation): following a user report or complaint; where there is a reasonable suspicion of a breach of the Terms or the law; to protect users' rights, security or privacy; in response to valid legal requests or legal obligations (including requests from competent public authorities, as permitted by applicable law).",
      "We do not carry out general or systematic monitoring of all conversations for commercial purposes unrelated to safety, moderation or compliance. Access is limited to authorised persons; certain administrative actions may be logged internally (e.g. admin review of conversations, ban actions).",
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
      "To exercise GDPR rights (access, rectification, erasure, restriction, portability, objection, complaint to a supervisory authority) and for privacy questions: contact@diebel.ro. In Romania, the supervisory authority is ANSPDCP (www.dataprotection.ro). Full legal identification of the controller (name, address) can be provided on request via the contact above.",
    ],
  },
];

const privacyDE: LegalSection[] = [
  {
    title: "Kurz gefasst (Diebel & App Stores)",
    content: [
      "Diebel ist eine Chat- und Anruf-App für Erwachsene: Nachrichten, Kennenlernen sowie Sprach- oder Videoanrufe. Dieser Abschnitt fasst für App Stores wie Google Play zusammen, welche Arten von Daten betroffen sein können.",
      "Verarbeitet werden können unter anderem: Kontodaten (E-Mail-Adresse; bei Anmeldung mit Google auch von Google bereitgestellte Informationen wie Kennung und E-Mail; bei SMS- oder Telefon-Flows die dort verwendete Telefonnummer), Inhalte von Nachrichten, die du über den Dienst sendest, technische Daten für den Betrieb (z. B. Gerät, Netzwerk) sowie Daten für Push-Benachrichtigungen (Tokens), um dich zu informieren (neue Nachrichten, Anrufe usw.), wenn du Benachrichtigungen auf dem Gerät erlaubst.",
      "Wir verkaufen oder vermieten deine personenbezogenen Daten nicht an Dritte zu deren eigenen Marketingzwecken.",
      "Wir nutzen Daten, um den Dienst bereitzustellen und abzusichern (Konto, Profil, Chat, Anrufe, Benachrichtigungen), das Produkt angemessen zu verbessern und unsere Nutzungsbedingungen sowie geltendes Recht einzuhalten.",
      "Fragen zum Datenschutz oder zur Ausübung deiner Rechte: contact@diebel.ro. Ausführliche Informationen folgen unten.",
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
      "Wir erheben: Identifikationsdaten (E-Mail, Name, Geburtsdatum, Geschlecht); Profildaten (Beschreibung, Präferenzen, Fotos, Stadt, Bildung, Beruf); Kommunikationsdaten (Textnachrichten und Dateianhänge in der App, einschließlich Bilder und Dokumente, innerhalb der erlaubten Funktionen); technische Daten (IP-Adresse, Gerätetyp, Browser, Fingerprint); Nutzungsdaten (Aktionen in der App, Matches, Besuche); und mit Ihrer Einwilligung Standortdaten (für die Entfernung zu anderen Nutzern).",
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
      "Zur Ausübung Ihrer Rechte kontaktieren Sie uns unter der in dieser Datenschutzrichtlinie oder in der App angegebenen E-Mail-Adresse. Wir antworten innerhalb von 30 Tagen.",
    ],
  },
  {
    title: "5. Aufbewahrung",
    content: [
      "Wir speichern Daten so lange, wie für die Erbringung des Dienstes, die Vertragsbeziehung und gesetzliche Verpflichtungen erforderlich. Nach Kontolöschung werden Daten innerhalb von 90 Tagen anonymisiert oder gelöscht, sofern keine gesetzliche Aufbewahrungspflicht besteht (z. B. Rechnungen).",
      "Sicherheitsprotokolle und Backups können vorübergehende Kopien enthalten; diese werden gemäß unserer internen Richtlinie rotiert und gelöscht.",
    ],
  },
  {
    title: "6. Sicherheit und Empfänger",
    content: [
      "Wir wenden geeignete technische und organisatorische Maßnahmen an (Verschlüsselung, eingeschränkter Zugriff, Schulung). Daten können an Dienstleister (Hosting, E-Mail, Analytik) übermittelt werden, die vertraglich gebunden sind und gegebenenfalls durch Standardvertragsklauseln.",
      "Wir verkaufen keine personenbezogenen Daten. Wir übermitteln keine Daten außerhalb des EWR ohne geeignete Rechtsgrundlage (Angemessenheitsbeschluss, Garantien, Standardklauseln).",
    ],
  },
  {
    title: "7. Nachrichten, Anhänge und Bilder im Chat",
    content: [
      "Textnachrichten und Dateien, die Sie über den Dienst senden (einschließlich Bilder, PDFs und anderer erlaubter Typen), werden verarbeitet, um sie Empfängern zuzustellen, den Verlauf anzuzeigen und die Nachrichtenfunktion zu betreiben.",
      "Solche Inhalte können auf unserer Infrastruktur oder der von Anbietern für Hosting, Speicherung und Sicherheit gespeichert werden, solange dies für den Dienst erforderlich ist und gemäß unserem Abschnitt zur Aufbewahrung.",
      "Soweit technisch eingerichtet, werden Chat-Bilder und PDFs in einem Speichersystem mit eingeschränktem Zugriff gespeichert und den Nutzern in der Regel nicht als direkte öffentliche URLs bereitgestellt. Die Anzeige in der App erfolgt über technische Prüfungen nach Anmeldung: Gesprächsteilnehmer können Anhänge innerhalb des Dienstes einsehen; autorisiertes Verwaltungspersonal kann unter den im Abschnitt zu Moderation und autorisierter Zugriff beschriebenen Voraussetzungen zugreifen. Ältere Inhalte oder Ausnahmefälle können technisch abweichen; wir bemühen uns, die Praxis dieser Beschreibung anzunähern.",
      "Senden Sie keine illegalen Inhalte, keine rechtsverletzenden Inhalte, keine Inhalte, die Minderjährige in unzulässiger Weise betreffen, und keine Inhalte, die die Privatsphäre Dritter verletzen. Sie sind für Ihre gesendeten Inhalte verantwortlich.",
    ],
  },
  {
    title: "8. Moderation, autorisierter Zugriff und Behördenzusammenarbeit",
    content: [
      "Zur Sicherheit der Plattform, zur Missbrauchsbekämpfung, zur Untersuchung von Verstößen und zur Einhaltung des Rechts können autorisierte technische und Moderationsmitarieder auf Inhalte von Mitteilungen und Dateien im Dienst (einschließlich Nachrichten und Bilder) in angemessener Weise und nur soweit nötig zugreifen.",
      "Der Zugriff kann insbesondere erfolgen (nicht abschließend): nach Meldung oder Beschwerde; bei begründetem Verdacht auf Verstoß gegen die Bedingungen oder das Recht; zum Schutz von Rechten, Sicherheit oder Privatsphäre der Nutzer; aufgrund gültiger rechtlicher Anfragen oder gesetzlicher Pflichten (einschließlich Anfragen zuständiger Behörden, soweit das anwendbare Recht es erlaubt).",
      "Wir führen keine allgemeine oder systematische Überwachung aller Gespräche zu kommerziellen Zwecken durch, die nicht mit Sicherheit, Moderation oder Compliance zusammenhängen. Der Zugriff ist auf autorisierte Personen beschränkt; bestimmte administrative Handlungen können intern protokolliert werden (z. B. Admin-Einsicht in Konversationen, Sperrungen).",
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
      "Zur Ausübung Ihrer DSGVO-Rechte (Auskunft, Berichtigung, Löschung, Einschränkung, Übertragbarkeit, Widerspruch, Beschwerde bei einer Aufsichtsbehörde) und für Datenschutzfragen: contact@diebel.ro. In Rumänien ist die Aufsichtsbehörde die ANSPDCP (www.dataprotection.ro). Vollständige Angaben zum Verantwortlichen (Name, Adresse) können auf Anfrage über die genannte Kontaktadresse mitgeteilt werden.",
    ],
  },
];

const cookiesRO: LegalSection[] = [
  {
    title: "1. Ce sunt cookie-urile",
    content: [
      "Cookie-urile sunt fișiere text de mici dimensiuni stocate pe dispozitivul dvs. când vizitați site-ul. Sunt folosite pentru funcționare, preferințe, statistici și publicitate. Respectăm Regulamentul (UE) 2016/679 (GDPR) și Directiva ePrivacy (unde este aplicabilă).",
    ],
  },
  {
    title: "2. Categorii de cookie-uri",
    content: [
      "Necesare: esențiale pentru autentificare, securitate și funcționalitate de bază. Nu necesită consimțământ.",
      "Funcționale: rețin preferințe (ex. limbă, setări). Sunt activate cu consimțământul dvs.",
      "Statistici: ne ajută să înțelegem traficul și utilizarea (ex. Google Analytics). Sunt activate cu consimțământul dvs.",
      "Marketing: folosite pentru reclame personalizate (ex. Meta Pixel, Google Ads). Sunt activate doar cu consimțământul dvs. explicit.",
    ],
  },
  {
    title: "3. Servicii terțe părți",
    content: [
      "Putem integra: Google Analytics (statistici); Meta Pixel (publicitate Facebook/Instagram); Google Ads (publicitate). Aceste servicii pot seta propriile cookie-uri și prelucra date conform politicilor lor. Încărcăm aceste scripturi doar după ce ați acceptat categoriile corespunzătoare în bannerul de cookie-uri.",
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
      "Pentru orice solicitare legată de datele tale personale (inclusiv ștergerea contului, exportul datelor, rectificare sau întrebări privind confidențialitatea), ne poți contacta la contact@diebel.ro. Vom răspunde în cel mai scurt timp posibil, în conformitate cu legislația aplicabilă.",
    ],
  },
];

const cookiesEN: LegalSection[] = [
  {
    title: "1. What cookies are",
    content: [
      "Cookies are small text files stored on your device when you visit the site. They are used for operation, preferences, statistics and advertising. We comply with Regulation (EU) 2016/679 (GDPR) and the ePrivacy Directive where applicable.",
    ],
  },
  {
    title: "2. Cookie categories",
    content: [
      "Necessary: essential for authentication, security and core functionality. They do not require consent.",
      "Functional: store preferences (e.g. language, settings). They are enabled with your consent.",
      "Statistics: help us understand traffic and usage (e.g. Google Analytics). They are enabled with your consent.",
      "Marketing: used for personalised advertising (e.g. Meta Pixel, Google Ads). They are only enabled with your explicit consent.",
    ],
  },
  {
    title: "3. Third-party services",
    content: [
      "We may integrate: Google Analytics (statistics); Meta Pixel (Facebook/Instagram advertising); Google Ads (advertising). These services may set their own cookies and process data in accordance with their policies. We load these scripts only after you have accepted the relevant categories in the cookie banner.",
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
      "For any request related to your personal data (including account deletion, data export, rectification, or privacy questions), you can contact us at contact@diebel.ro. We will respond as soon as possible in accordance with applicable data protection laws.",
    ],
  },
];

const cookiesDE: LegalSection[] = [
  {
    title: "1. Was sind Cookies",
    content: [
      "Cookies sind kleine Textdateien, die auf Ihrem Gerät gespeichert werden, wenn Sie die Website besuchen. Sie dienen dem Betrieb, Präferenzen, Statistiken und Werbung. Wir beachten die Verordnung (EU) 2016/679 (DSGVO) und die ePrivacy-Richtlinie, soweit anwendbar.",
    ],
  },
  {
    title: "2. Cookie-Kategorien",
    content: [
      "Notwendig: für Authentifizierung, Sicherheit und Grundfunktionen unerlässlich. Sie erfordern keine Einwilligung.",
      "Funktional: speichern Präferenzen (z. B. Sprache, Einstellungen). Sie werden mit Ihrer Einwilligung aktiviert.",
      "Statistik: helfen uns, Traffic und Nutzung zu verstehen (z. B. Google Analytics). Sie werden mit Ihrer Einwilligung aktiviert.",
      "Marketing: für personalisierte Werbung (z. B. Meta Pixel, Google Ads). Sie werden nur mit Ihrer ausdrücklichen Einwilligung aktiviert.",
    ],
  },
  {
    title: "3. Dienste Dritter",
    content: [
      "Wir können integrieren: Google Analytics (Statistik); Meta Pixel (Facebook-/Instagram-Werbung); Google Ads (Werbung). Diese Dienste können eigene Cookies setzen und Daten gemäß ihren Richtlinien verarbeiten. Wir laden diese Skripte erst, nachdem Sie die entsprechenden Kategorien im Cookie-Banner akzeptiert haben.",
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
      "Für alle Anfragen im Zusammenhang mit Ihren personenbezogenen Daten (einschließlich Kontolöschung, Datenexport, Berichtigung oder Fragen zum Datenschutz) können Sie uns unter contact@diebel.ro erreichen. Wir beantworten Ihre Anfrage so schnell wie möglich gemäß den geltenden Datenschutzgesetzen.",
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
