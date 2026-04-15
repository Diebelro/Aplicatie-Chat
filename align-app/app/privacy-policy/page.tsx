import { permanentRedirect } from "next/navigation";

/** Alias pentru magazine (ex. Google Play); redirectul din `next.config.js` acoperă și build-uri unde ruta lipsea. */
export default function PrivacyPolicyAliasPage() {
  permanentRedirect("/privacy");
}
