import json
import re
import sys

import requests

GRAPHQL_URL = "https://leetcode.com/graphql"
LEETCODE_URL = "https://leetcode.com/problems/binary-tree-level-order-traversal-ii/?envType=problem-list-v2&envId=binary-tree"
OUTPUT_FILE = "solution.cpp"

QUERY = """
query questionData($titleSlug: String!) {
  question(titleSlug: $titleSlug) {
    title
    titleSlug
    sampleTestCase
    exampleTestcases
    metaData
    codeSnippets {
      lang
      langSlug
      code
    }
  }
}
"""


def extract_slug(url: str) -> str:
    match = re.search(r"/problems/([^/]+)/", url)
    if not match:
        raise ValueError("Could not extract problem slug from URL.")
    return match.group(1)


def fetch_question_data(title_slug: str) -> dict:
    headers = {
        "Content-Type": "application/json",
        "Referer": f"https://leetcode.com/problems/{title_slug}/",
        "User-Agent": "Mozilla/5.0",
    }

    response = requests.post(
        GRAPHQL_URL,
        json={
            "query": QUERY,
            "variables": {"titleSlug": title_slug},
        },
        headers=headers,
        timeout=20,
    )
    response.raise_for_status()

    payload = response.json()
    if "errors" in payload:
        raise RuntimeError(f"GraphQL error: {payload['errors']}")

    question = payload.get("data", {}).get("question")
    if not question:
        raise RuntimeError("Question data not found.")

    return question


def split_generic_args(s: str) -> list[str]:
    args = []
    current = []
    depth = 0

    for ch in s:
        if ch == "<":
            depth += 1
            current.append(ch)
        elif ch == ">":
            depth -= 1
            current.append(ch)
        elif ch == "," and depth == 0:
            args.append("".join(current).strip())
            current = []
        else:
            current.append(ch)

    if current:
        args.append("".join(current).strip())

    return args


def lc_type_to_cpp(type_name: str) -> str:
    type_name = type_name.strip()

    base_map = {
        "integer": "int",
        "int": "int",
        "long": "long long",
        "boolean": "bool",
        "string": "string",
        "character": "char",
        "char": "char",
        "double": "double",
        "float": "double",
        "void": "void",
    }

    if type_name in base_map:
        return base_map[type_name]

    if type_name.endswith("[]"):
        inner = type_name[:-2].strip()
        return f"vector<{lc_type_to_cpp(inner)}>"

    if type_name.startswith("list<") and type_name.endswith(">"):
        inner = type_name[5:-1].strip()
        return f"vector<{lc_type_to_cpp(inner)}>"

    if "<" in type_name and type_name.endswith(">"):
        outer = type_name[: type_name.index("<")].strip()
        inner = type_name[type_name.index("<") + 1 : -1].strip()
        args = split_generic_args(inner)
        cpp_args = ", ".join(lc_type_to_cpp(arg) for arg in args)

        generic_map = {
            "list": "vector",
            "array": "vector",
        }

        outer_cpp = generic_map.get(outer, outer)
        return f"{outer_cpp}<{cpp_args}>"

    return type_name


def default_value_for_type(type_name: str) -> str:
    cpp_type = lc_type_to_cpp(type_name)

    if cpp_type.startswith("vector<"):
        return "{}"
    if cpp_type == "string":
        return '""'
    if cpp_type == "char":
        return "'a'"
    if cpp_type == "bool":
        return "false"
    if cpp_type == "double":
        return "0.0"
    return "0"


def to_cpp_literal(raw_value: str, type_name: str) -> str:
    raw_value = raw_value.strip()

    if "=" in raw_value:
        raw_value = raw_value.split("=", 1)[1].strip()

    cpp_type = lc_type_to_cpp(type_name)

    if cpp_type.startswith("vector<"):
        return raw_value.replace("[", "{").replace("]", "}")

    if cpp_type == "string":
        if raw_value.startswith('"') and raw_value.endswith('"'):
            return raw_value
        return json.dumps(raw_value)

    if cpp_type == "char":
        if raw_value.startswith("'") and raw_value.endswith("'"):
            return raw_value
        if len(raw_value) == 1:
            return f"'{raw_value}'"
        return "'a'"

    if cpp_type == "bool":
        lowered = raw_value.lower()
        if lowered in {"true", "false"}:
            return lowered
        return "false"

    return raw_value


def get_cpp_snippet(code_snippets: list[dict]) -> str:
    for snippet in code_snippets:
        if snippet.get("langSlug") == "cpp":
            return snippet["code"]

    for snippet in code_snippets:
        if snippet.get("lang") == "C++":
            return snippet["code"]

    raise RuntimeError("C++ code snippet not found.")


def get_sample_lines(question: dict) -> list[str]:
    sample = question.get("sampleTestCase") or ""
    lines = [line.strip() for line in sample.splitlines() if line.strip()]
    if lines:
        return lines

    examples = question.get("exampleTestcases") or ""
    blocks = [block.strip() for block in examples.split("\n\n") if block.strip()]
    if not blocks:
        return []

    return [line.strip() for line in blocks[0].splitlines() if line.strip()]


def is_vector_type(cpp_type: str) -> bool:
    return cpp_type.startswith("vector<")


def build_result_print(return_type: str) -> str:
    if return_type == "void":
        return ""

    if is_vector_type(return_type):
        return """\tfor (auto k : result) {
\t\tcout << k << " ";
\t}
\tcout << "\\n";"""

    return """\tcout << result << "\\n";"""


def build_cpp_file(question: dict) -> str:
    meta = json.loads(question["metaData"])
    params = meta.get("params", [])
    func_name = meta["name"]
    return_type = lc_type_to_cpp(meta["return"]["type"])
    cpp_snippet = get_cpp_snippet(question["codeSnippets"])
    sample_lines = get_sample_lines(question)

    declarations = []
    arg_names = []

    for i, param in enumerate(params):
        param_name = param["name"]
        param_type = param["type"]
        cpp_type = lc_type_to_cpp(param_type)

        if i < len(sample_lines):
            value = to_cpp_literal(sample_lines[i], param_type)
        else:
            value = default_value_for_type(param_type)

        declarations.append(f"\t{cpp_type} {param_name} = {value};")
        arg_names.append(param_name)

    args_str = ", ".join(arg_names)

    if return_type == "void":
        invoke = f"\tsol->" + func_name + f"({args_str});"
    else:
        invoke = f"\t{return_type} result = sol->" + func_name + f"({args_str});"

    result_print = build_result_print(return_type)

    return f"""#include <bits/stdc++.h>
using namespace std;
using ll = long long int;
using ull = unsigned long long int;

{cpp_snippet}

int main() {{
{chr(10).join(declarations)}

\tSolution *sol = new Solution();
{invoke}

{result_print}

\tdelete sol;
\treturn 0;
}}
"""


def main() -> None:
    try:
        slug = extract_slug(LEETCODE_URL)
        question = fetch_question_data(slug)
        cpp_code = build_cpp_file(question)

        with open(OUTPUT_FILE, "w", encoding="utf-8") as file:
            file.write(cpp_code)

        print(f"Generated: {OUTPUT_FILE}")
    except Exception as error:
        print(f"Error: {error}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
