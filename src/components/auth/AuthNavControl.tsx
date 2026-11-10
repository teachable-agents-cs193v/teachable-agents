"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { authClient } from "@/lib/auth/client";
import { firstName } from "@/lib/auth/displayName";
import { withNext } from "@/lib/auth/nextPath";
import { cn } from "@/lib/utils";

/**
 * The Navbar's sign-in / sign-out control (owned by auth). The session here is
 * for display only; pages and API routes check it on the server.
 *
 * `layout="bar"` fits the desktop nav; `layout="menu"` stacks for the mobile menu.
 */
export function AuthNavControl({ layout = "bar", onNavigate }: { layout?: "bar" | "menu"; onNavigate?: () => void }) {
  const { data, isPending } = authClient.useSession();
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const menu = layout === "menu";

  // Reserve the space while the session loads, so the bar doesn't jump.
  if (isPending) return <span aria-hidden className={cn("block", menu ? "h-11" : "h-9 w-40")} />;

  if (data?.user) {
    const logOut = async () => {
      setLoggingOut(true);
      try {
        await authClient.signOut();
      } finally {
        onNavigate?.();
        router.push("/");
        router.refresh();
        setLoggingOut(false);
      }
    };
    return (
      <div className={cn("flex items-center gap-3", menu && "flex-col items-stretch")}>
        <span className="text-[15px] text-charcoal/80" data-testid="auth-greeting">
          Hi, <span className="font-medium text-forest">{firstName(data.user.name, data.user.email)}</span>
        </span>
        <Button variant="outline" size={menu ? "md" : "sm"} onClick={logOut} disabled={loggingOut} className={cn(menu && "w-full")}>
          {loggingOut ? "Logging out…" : "Log out"}
        </Button>
      </div>
    );
  }

  // Come back to this page after logging in (not to the login page itself).
  const here = pathname === "/login" || pathname === "/signup" ? undefined : pathname;
  return (
    <div className={cn("flex items-center gap-2", menu && "flex-col items-stretch")}>
      <Link
        href={withNext("/login", here)}
        onClick={onNavigate}
        className={cn(
          "focus-ring rounded-full px-4 py-2 text-[15px] font-medium text-charcoal/80 transition-colors hover:bg-sage/50 hover:text-forest",
          menu && "rounded-xl px-3 py-2.5 text-charcoal",
        )}
      >
        Log in
      </Link>
      <Button href={withNext("/signup", here)} variant="secondary" size={menu ? "md" : "sm"} className={cn(menu && "w-full")}>
        Sign up
      </Button>
    </div>
  );
}
