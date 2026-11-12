import { describe, expect, it } from "vitest";
import { firstName } from "../displayName";
import { NETWORK_ERROR, describeAuthError } from "../errorMessages";

describe("describeAuthError", () => {
  it("shows the server's own wording, the zxcvbn warning and the tips for policy codes", () => {
    const r = describeAuthError(
      {
        status: 422,
        code: "weak_password",
        message: "Please choose a password that's harder to guess.",
        warning: "This is a very common password.",
        suggestions: ["Add another word or two.", 3],
      },
      "signup",
    );
    expect(r.message).toBe("Please choose a password that's harder to guess. This is a very common password.");
    expect(r.tips).toEqual(["Add another word or two."]);
    for (const code of ["breached_password", "breach_check_unavailable"]) {
      expect(describeAuthError({ code, message: `server text for ${code}` }, "signup").message).toBe(`server text for ${code}`);
    }
  });

  it("still says something if a policy error arrives without a message", () => {
    expect(describeAuthError({ code: "breached_password" }, "signup").message).toBe("Please choose a different password.");
  });

  it("explains when sign-in isn't set up (development without a database)", () => {
    expect(describeAuthError({ status: 503, code: "auth_unavailable" }, "login").message).toMatch(/isn't set up/);
  });

  it("ties each error to the input it's about, and general errors to none", () => {
    const field = (code?: string, status?: number) => describeAuthError({ code, status }, "signup").field;
    expect(field("weak_password")).toBe("password");
    expect(field("breached_password")).toBe("password");
    expect(field("PASSWORD_TOO_LONG")).toBe("password");
    expect(field("INVALID_EMAIL")).toBe("email");
    expect(field("USER_ALREADY_EXISTS")).toBe("email");
    expect(field("missing_name")).toBe("name");
    for (const general of [field(undefined, 429), field("auth_unavailable", 503), field(undefined, 500), NETWORK_ERROR.field]) {
      expect(general).toBeUndefined();
    }
  });

  it("asks for a name when it's missing", () => {
    expect(describeAuthError({ code: "missing_name" }, "signup").message).toBe("Please enter your name.");
  });

  it("offers to log in when the email is taken", () => {
    for (const code of ["USER_ALREADY_EXISTS", "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL"]) {
      expect(describeAuthError({ status: 422, code }, "signup")).toMatchObject({ offerLogin: true });
    }
  });

  it("gives one generic message for a wrong password or unknown email", () => {
    const byCode = describeAuthError({ status: 401, code: "INVALID_EMAIL_OR_PASSWORD" }, "login");
    const byStatus = describeAuthError({ status: 401 }, "login");
    expect(byCode.message).toBe(byStatus.message);
    expect(byCode.message).not.toMatch(/no account|not registered|wrong password/i);
  });

  it("asks people to wait when rate limited", () => {
    expect(describeAuthError({ status: 429 }, "login").message).toMatch(/Too many attempts/);
  });

  it("covers Better Auth's length and email codes", () => {
    expect(describeAuthError({ code: "PASSWORD_TOO_SHORT" }, "signup").message).toMatch(/at least 8/);
    expect(describeAuthError({ code: "PASSWORD_TOO_LONG" }, "signup").message).toMatch(/at most 128/);
    expect(describeAuthError({ code: "INVALID_EMAIL" }, "login").message).toMatch(/valid email/);
  });

  it("falls back to a generic message for anything unknown, without echoing server text", () => {
    const r = describeAuthError({ status: 500, code: "SOMETHING_NEW", message: "internal: stack trace" }, "signup");
    expect(r.message).toBe("We couldn't create your account. Please try again.");
    expect(r.tips).toEqual([]);
    expect(NETWORK_ERROR.message).toMatch(/couldn't reach the server/);
  });
});

describe("firstName", () => {
  it("uses the first word of the name, or the email's local part", () => {
    expect(firstName("  Jordan   Lee ")).toBe("Jordan");
    expect(firstName("", "avery.kim@example.com")).toBe("avery.kim");
    expect(firstName(null, null)).toBe("there");
  });
});
