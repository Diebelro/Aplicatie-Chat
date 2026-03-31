/** Mapare mesaje RO returnate de API → chei `pages.apiErrors.*` */

const RO_TO_PATH: Record<string, string> = {
  "Neautorizat.": "pages.apiErrors.unauthorized",
  "Lipsește parametrul with.": "pages.apiErrors.missingWith",
  "Utilizator negăsit.": "pages.apiErrors.userNotFound",
  "Corp invalid (JSON).": "pages.apiErrors.invalidJson",
  "Coordonate locație invalide.": "pages.apiErrors.invalidCoords",
  "Trimite fie locație, fie fișier atașat, nu ambele în același mesaj.": "pages.apiErrors.locationOrAttachment",
  "Lipsește toId.": "pages.apiErrors.missingToId",
  "Adaugă text, locație sau un atașament (poză/PDF).": "pages.apiErrors.needContent",
  "Destinatar negăsit.": "pages.apiErrors.recipientNotFound",
  "Nu poți trimite mesaje acestui utilizator.": "pages.apiErrors.cannotMessage",
  "Utilizatorul sau destinatarul nu există în baza de date. Reîncearcă după reconectare.": "pages.apiErrors.dbMismatch",
  "Înregistrarea nu a fost găsită. Reîncearcă.": "pages.apiErrors.recordNotFound",
  "Salvează mai întâi locația (ex. din Toate profilurile), apoi activează vizibilitatea pe hartă.":
    "pages.apiErrors.saveLocationFirstLong",
  "Salvează mai întâi locația, apoi activează vizibilitatea pe hartă.": "pages.apiErrors.saveLocationFirstShort",
  "Nu există locație salvată.": "pages.apiErrors.noSavedLocation",
  "Eroare server.": "pages.apiErrors.serverError",
  "Sesiunea a expirat. Ieși și conectează-te din nou.": "pages.apiErrors.sessionExpired",
  "Prea multe cereri. Încearcă mai târziu.": "pages.apiErrors.rateLimit",
  "Corp invalid.": "pages.apiErrors.invalidBody",
  "Parolă incorectă.": "pages.apiErrors.wrongPassword",
  "Nu s-a putut trimite.": "pages.feedback.sendFailed",
  "Nu s-a putut trimite cererea.": "pages.banAppeal.sendFailed",
  "Eroare la trimitere": "pages.forgotPassword.errSend",
  "Eroare la trimitere.": "pages.forgotPassword.errSend",
  "Eroare la resetare": "pages.resetPassword.errReset",
  "Eroare la resetarea parolei.": "pages.resetPassword.errReset",
  "Eroare la verificare": "pages.verifyEmail.errVerify",
  "Eroare la verificare.": "pages.verifyEmail.errVerify",
  "Eroare la retrimitere": "pages.verifyEmail.errResend",
  "Eroare la retrimitere.": "pages.verifyEmail.errResend",
  "Eroare la confirmare": "pages.mobileRecover.errConfirm",
  "Eroare la confirmare.": "pages.mobileRecover.errConfirm",
  "Sesiunea a expirat. Încearcă din nou.": "pages.forgotPassword.sessionExpired",
  "Eroare la salvare.": "pages.profile.errSave",
  "Nu am putut salva: sesiune nevalidă sau întreruptă. Ieși din cont (meniu) și intră din nou; dacă persistă, șterge cookie-urile pentru acest site.":
    "pages.profile.errSessionSave",
};

export function translateApiErrorMessage(message: string, tStr: (path: string) => string): string {
  const t = message?.trim();
  if (!t) return "";
  const path = RO_TO_PATH[t];
  if (path) {
    const localized = tStr(path);
    if (localized) return localized;
  }
  return message;
}
