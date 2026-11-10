import { describe, expect, it } from "vitest";
import { NETWORK_ERROR, describeAuthError, firstName } from "../errorMessages";

describe("describeAuthError", () => {
  it("shows the zxcvbn warning and tips for a weak password", () => {
    const r = describeAuthError(
      { status: 422, code: "weak_password", warning: "This is a very common password.", suggestions: ["Add another word or two.", 3] },
      "signup",
    );
    expect(r.message).toMatch(/too easy to guess\. This is a very common password\./);
    expect(r.tips).toEqual(["Add another word or two."]);
  });

  it("explains a breached password with its tips", () => {
    const r = describeAuthError({ status: 422, code: "breached_password", suggestions: ["Avoid reusing a password."] }, "signup");
    expect(r.message).toMatch(/known data breach/);
    expect(r.tips).toEqual(["Avoid reusing a password."]);
  });

  it("says the account wasn't created when the breach check is down", () => {
    expect(describeAuthError({ status: 503, code: "breach_check_unavailable" }, "signup").message).toMatch(
      /wasn't created.*try again/,
    );
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
