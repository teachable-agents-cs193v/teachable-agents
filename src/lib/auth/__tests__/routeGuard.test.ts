// Every page must either require a login or be listed here as public, so a new
// page can't be left unprotected by accident (docs/AUTH.md, "What is protected";
// added in PR #23). It checks that the page calls requireUser(), not where:
// call it first, before reading any student data.
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/** Pages anyone may see. Add a page here ONLY if it shows no student data. */
const PUBLIC_PAGES = new Set(["/", "/topics", "/login", "/signup"]);

const APP_DIR = path.resolve(__dirname, "../../../app");

function findPages(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return findPages(full);
    return /^page\.(tsx?|jsx?|mdx)$/.test(name) ? [full] : [];
  });
}

/** src/app/sessions/[sessionId]/page.tsx → /sessions/[sessionId] (route groups dropped). */
function routeOf(file: string): string {
  const segments = path.relative(APP_DIR, path.dirname(file)).split(path.sep).filter((s) => s && !/^\(.*\)$/.test(s));
  return "/" + segments.join("/");
}

describe("route guard", () => {
  const pages = findPages(APP_DIR).map((file) => ({ file, route: routeOf(file) }));

  it("finds the app's pages", () => {
    expect(pages.map((p) => p.route)).toEqual(expect.arrayContaining(["/", "/topics", "/sessions", "/teach/[sessionId]"]));
  });

  it.each(pages.map((p) => [p.route, p.file] as const))("%s requires a login or is listed as public", (route, file) => {
    if (PUBLIC_PAGES.has(route)) return;
    // Ignore comments, so a commented-out call doesn't count.
    const source = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    const guarded = /\bawait\s+requireUser\(/.test(source);
    // e.g. "/sessions" or `/teach/${sessionId}` for a route with parameters
    const pathArg = route.includes("[") ? "`" + route.replace(/\[(\w+)\]/g, "${encodeURIComponent($1)}") + "`" : `"${route}"`;
    expect(
      guarded,
      `${path.relative(process.cwd(), file)} (${route}) doesn't require a login.\n` +
        `  → If it shows a student's data, add near the top of the page function:\n` +
        `      await requireUser(${pathArg});\n` +
        `    (import { requireUser } from "@/lib/auth/server"; pass the page's own path so login returns here)\n` +
        `  → If it's genuinely public, add "${route}" to PUBLIC_PAGES in src/lib/auth/__tests__/routeGuard.test.ts.`,
    ).toBe(true);
  });

  it("doesn't list pages as public that no longer exist", () => {
    const routes = new Set(pages.map((p) => p.route));
    for (const route of PUBLIC_PAGES) expect(routes.has(route), `PUBLIC_PAGES lists "${route}", which has no page`).toBe(true);
  });
});
