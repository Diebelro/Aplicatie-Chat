import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

/** Next 16 nu mai expune `next lint`; folosim config-ul flat din `eslint-config-next`. */
const config = [
  ...nextCoreWebVitals,
  {
    rules: {
      // Plugin react-hooks v7 — reguli noi care resping pattern-uri frecvente în codul existent.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off",
      "react-hooks/purity": "off",
      "react-hooks/static-components": "off",
    },
  },
];

export default config;
