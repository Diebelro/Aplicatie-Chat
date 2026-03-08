/**
 * Pentru butonul „Detalii la cerere”: scroll la contact, autofill subiect, focus pe mesaj.
 */
export function handleDetailsRequest(context: string): void {
  if (typeof document === "undefined") return;
  const contactSection = document.querySelector("#contact");
  const subjectField = document.querySelector("#contact-subject") as HTMLInputElement | null;
  const messageField = document.querySelector("#contact-message") as HTMLTextAreaElement | null;

  if (subjectField) {
    subjectField.value = `Detalii la cerere – ${context}`;
  }

  if (contactSection) {
    contactSection.scrollIntoView({ behavior: "smooth" });
  }

  if (messageField) {
    messageField.focus();
  }
}
