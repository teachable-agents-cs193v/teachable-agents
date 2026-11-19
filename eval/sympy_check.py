"""Checks derivatives Pip wrote, for the eval report (eval/sympy.ts). Reads JSON from stdin:
[{"function": "x**3", "pipAnswer": "3*x**2", "asTaught": "3*x**2" | null}, ...]
and prints, per item: {"ok": bool, "pipIsTrue": bool|null, "pipMatchesTaught": bool|null, "truth": str|null, "error": str|null}.

Expressions come from the judge's output, so they are checked against a strict character and
name allowlist before sympy parses them.
"""

import json
import re
import sys

import sympy
from sympy.parsing.sympy_parser import convert_xor, implicit_multiplication_application, parse_expr, standard_transformations

x = sympy.Symbol("x")
NAMES = {"x": x, "sin": sympy.sin, "cos": sympy.cos, "tan": sympy.tan, "exp": sympy.exp, "ln": sympy.log, "log": sympy.log, "sqrt": sympy.sqrt, "e": sympy.E, "E": sympy.E, "pi": sympy.pi}
ALLOWED = re.compile(r"^[0-9x+\-*/^(). a-z]*$")
TRANSFORMS = standard_transformations + (convert_xor, implicit_multiplication_application)


def parse(text):
    if text is None:
        return None
    s = str(text).strip().replace("·", "*").replace("−", "-")
    if not s or len(s) > 120 or not ALLOWED.match(s):
        raise ValueError(f"not a simple expression: {text!r}")
    for word in re.findall(r"[a-z]+", s):
        if word not in NAMES:
            raise ValueError(f"unknown name {word!r}")
    return parse_expr(s, local_dict=dict(NAMES), global_dict={"__builtins__": {}, **{k: getattr(sympy, k) for k in ("Integer", "Float", "Rational", "Symbol")}}, transformations=TRANSFORMS)


def same(a, b):
    return bool(sympy.simplify(a - b) == 0)


def check(item):
    try:
        f = parse(item.get("function"))
        pip = parse(item.get("pipAnswer"))
        taught = parse(item.get("asTaught"))
        truth = sympy.diff(f, x)
        return {
            "ok": True,
            "pipIsTrue": same(pip, truth),
            "pipMatchesTaught": None if taught is None else same(pip, taught),
            "truth": str(truth),
            "error": None,
        }
    except Exception as error:  # noqa: BLE001 - reported per item
        return {"ok": False, "pipIsTrue": None, "pipMatchesTaught": None, "truth": None, "error": str(error)[:200]}


if __name__ == "__main__":
    print(json.dumps([check(i) for i in json.load(sys.stdin)]))
