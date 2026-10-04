import type { ReactNode } from "react";
import { AppShell } from "./AppShell";

/**
 * Layout server: slotul `@modal` trebuie primit aici (nu într-un Client Component),
 * altfel interceptarea `/app/user/[id]` nu păstrează lista de profiluri montată.
 */
export default function AppSegmentLayout({
  children,
  modal,
}: {
  children: ReactNode;
  modal: ReactNode;
}) {
  return <AppShell modal={modal}>{children}</AppShell>;
}
