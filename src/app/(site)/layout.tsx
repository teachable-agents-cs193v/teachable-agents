import { Footer } from "@/components/Footer";
import { SiteNav } from "@/components/nav/SiteNav";

/**
 * The shared shell for every page except the teaching workspace, which lives
 * in the (focus) group and draws its own header. The nav is rendered on the
 * server from the real session, so there is no logged-in/logged-out flicker.
 *
 * Access is still decided per page (requireUser) and per API route, never here:
 * layouts don't re-render on client navigation, so they can't be a guard.
 */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteNav />
      <main className="flex flex-1 flex-col">{children}</main>
      <Footer />
    </>
  );
}
