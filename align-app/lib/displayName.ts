/** Returnează numele afișat cu prima literă mare. */
export function displayName(name: string | null | undefined): string {
  if (!name || name.length === 0) return "";
  return name.charAt(0).toUpperCase() + name.slice(1);
}
