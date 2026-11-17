import { getCurrentUser } from "@/lib/auth/server";
import { AuthNavControl } from "@/components/auth/AuthNavControl";
import { NavBar, type NavLink } from "./NavBar";

/** What a visitor sees: the product, not the workspace. */
const PUBLIC_LINKS: NavLink[] = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/about", label: "About" },
];

/** What a logged-in student sees: their dashboard, the lessons, their log, and their account. */
const STUDENT_LINKS: NavLink[] = [
  { href: "/dashboard", label: "Home" },
  { href: "/topics", label: "Lessons" },
  { href: "/sessions", label: "My sessions" },
  { href: "/profile", label: "Profile" },
];

/**
 * The site navigation, decided on the server from the real session so the
 * right set of links renders on the first paint. The login / logout control
 * itself is auth's AuthNavControl, unchanged.
 */
export async function SiteNav() {
  const user = await getCurrentUser();
  const links = user ? STUDENT_LINKS : PUBLIC_LINKS;
  return (
    <NavBar links={links} loggedIn={!!user} control={<AuthNavControl />} menuControl={<AuthNavControl layout="menu" />} />
  );
}
