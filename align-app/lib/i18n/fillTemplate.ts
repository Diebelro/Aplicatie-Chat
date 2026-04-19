/** Înlocuiește `{{cheie}}` în șiruri din JSON (ex. `{{maxMin}}`, `{{detail}}`). */
export function fillTemplate(template: string, vars: Record<string, string | number>): string {
  let s = template;
  for (const [k, v] of Object.entries(vars)) {
    s = s.split(`{{${k}}}`).join(String(v));
  }
  return s;
}
