const GRAPHQL_URL = "https://leetcode.com/graphql";

const QUERY = `
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
`;

type CodeSnippet = {
  lang?: string;
  langSlug?: string;
  code: string;
};

type Question = {
  sampleTestCase?: string | null;
  exampleTestcases?: string | null;
  metaData: string;
  codeSnippets: CodeSnippet[];
};

type MetaParam = {
  name: string;
  type: string;
};

type MetaData = {
  name: string;
  params?: MetaParam[];
  return: {
    type: string;
  };
};

export function extractSlug(url: string): string {
  const match = url.match(/\/problems\/([^/]+)\//);
  if (!match) {
    throw new Error("Could not extract problem slug from URL.");
  }
  return match[1];
}

export async function generateCppFromUrl(url: string): Promise<string> {
  const slug = extractSlug(url);
  const question = await fetchQuestionData(slug);
  return buildCppFile(question);
}

async function fetchQuestionData(titleSlug: string): Promise<Question> {
  const response = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Referer: `https://leetcode.com/problems/${titleSlug}/`,
      "User-Agent": "Mozilla/5.0",
    },
    body: JSON.stringify({
      query: QUERY,
      variables: { titleSlug },
    }),
  });

  if (!response.ok) {
    throw new Error(`LeetCode request failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as {
    errors?: unknown;
    data?: { question?: Question | null };
  };

  if (payload.errors) {
    throw new Error(`GraphQL error: ${JSON.stringify(payload.errors)}`);
  }

  const question = payload.data?.question;
  if (!question) {
    throw new Error("Question data not found.");
  }

  return question;
}

function splitGenericArgs(value: string): string[] {
  const args: string[] = [];
  let current = "";
  let depth = 0;

  for (const ch of value) {
    if (ch === "<") {
      depth += 1;
      current += ch;
    } else if (ch === ">") {
      depth -= 1;
      current += ch;
    } else if (ch === "," && depth === 0) {
      args.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }

  if (current) {
    args.push(current.trim());
  }

  return args;
}

function lcTypeToCpp(typeName: string): string {
  const trimmed = typeName.trim();

  const baseMap: Record<string, string> = {
    integer: "int",
    int: "int",
    long: "long long",
    boolean: "bool",
    string: "string",
    character: "char",
    char: "char",
    double: "double",
    float: "double",
    void: "void",
  };

  if (trimmed in baseMap) {
    return baseMap[trimmed];
  }

  if (trimmed.endsWith("[]")) {
    return `vector<${lcTypeToCpp(trimmed.slice(0, -2).trim())}>`;
  }

  if (trimmed.startsWith("list<") && trimmed.endsWith(">")) {
    return `vector<${lcTypeToCpp(trimmed.slice(5, -1).trim())}>`;
  }

  if (trimmed.includes("<") && trimmed.endsWith(">")) {
    const outer = trimmed.slice(0, trimmed.indexOf("<")).trim();
    const inner = trimmed.slice(trimmed.indexOf("<") + 1, -1).trim();
    const cppArgs = splitGenericArgs(inner).map(lcTypeToCpp).join(", ");
    const genericMap: Record<string, string> = {
      list: "vector",
      array: "vector",
    };
    return `${genericMap[outer] ?? outer}<${cppArgs}>`;
  }

  return trimmed;
}

function defaultValueForType(typeName: string): string {
  const cppType = lcTypeToCpp(typeName);

  if (cppType.startsWith("vector<")) {
    return "{}";
  }
  if (cppType === "string") {
    return "\"\"";
  }
  if (cppType === "char") {
    return "'a'";
  }
  if (cppType === "bool") {
    return "false";
  }
  if (cppType === "double") {
    return "0.0";
  }
  return "0";
}

function toCppLiteral(rawValue: string, typeName: string): string {
  let value = rawValue.trim();

  if (value.includes("=")) {
    value = value.split("=", 2)[1].trim();
  }

  const cppType = lcTypeToCpp(typeName);

  if (cppType.startsWith("vector<")) {
    return value.replace(/\[/g, "{").replace(/\]/g, "}");
  }

  if (cppType === "string") {
    if (value.startsWith("\"") && value.endsWith("\"")) {
      return value;
    }
    return JSON.stringify(value);
  }

  if (cppType === "char") {
    if (value.startsWith("'") && value.endsWith("'")) {
      return value;
    }
    if (value.length === 1) {
      return `'${value}'`;
    }
    return "'a'";
  }

  if (cppType === "bool") {
    const lowered = value.toLowerCase();
    return lowered === "true" || lowered === "false" ? lowered : "false";
  }

  return value;
}

function getCppSnippet(codeSnippets: CodeSnippet[]): string {
  const cppBySlug = codeSnippets.find((snippet) => snippet.langSlug === "cpp");
  if (cppBySlug) {
    return cppBySlug.code;
  }

  const cppByName = codeSnippets.find((snippet) => snippet.lang === "C++");
  if (cppByName) {
    return cppByName.code;
  }

  throw new Error("C++ code snippet not found.");
}

function getSampleLines(question: Question): string[] {
  const sample = question.sampleTestCase?.trim();
  if (sample) {
    const lines = sample
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length > 0) {
      return lines;
    }
  }

  const examples = question.exampleTestcases?.trim();
  if (!examples) {
    return [];
  }

  const firstBlock = examples
    .split("\n\n")
    .map((block) => block.trim())
    .find(Boolean);

  return firstBlock
    ? firstBlock
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
    : [];
}

function isVectorType(cppType: string): boolean {
  return cppType.startsWith("vector<");
}

function buildResultPrint(returnType: string): string {
  if (returnType === "void") {
    return "";
  }

  if (isVectorType(returnType)) {
    return '\tfor (auto k : result) {\n\t\tcout << k << " ";\n\t}\n\tcout << "\\n";';
  }

  return '\tcout << result << "\\n";';
}

function buildCppFile(question: Question): string {
  const meta = JSON.parse(question.metaData) as MetaData;
  const params = meta.params ?? [];
  const funcName = meta.name;
  const returnType = lcTypeToCpp(meta.return.type);
  const cppSnippet = getCppSnippet(question.codeSnippets);
  const sampleLines = getSampleLines(question);

  const declarations: string[] = [];
  const argNames: string[] = [];

  params.forEach((param, index) => {
    const cppType = lcTypeToCpp(param.type);
    const value =
      index < sampleLines.length
        ? toCppLiteral(sampleLines[index], param.type)
        : defaultValueForType(param.type);

    declarations.push(`\t${cppType} ${param.name} = ${value};`);
    argNames.push(param.name);
  });

  const args = argNames.join(", ");
  const invoke =
    returnType === "void"
      ? `\tsol->${funcName}(${args});`
      : `\t${returnType} result = sol->${funcName}(${args});`;

  return `#include <bits/stdc++.h>
using namespace std;
using ll = long long int;
using ull = unsigned long long int;

${cppSnippet}

int main() {
${declarations.join("\n")}

\tSolution *sol = new Solution();
${invoke}

${buildResultPrint(returnType)}

\tdelete sol;
\treturn 0;
}
`;
}
