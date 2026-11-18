/** The first word of the student's name, for the Navbar greeting. */
export function firstName(name: string | null | undefined, email?: string | null): string {
  const first = name?.trim().split(/\s+/)[0];
  return first || email?.split("@")[0] || "there";
}
