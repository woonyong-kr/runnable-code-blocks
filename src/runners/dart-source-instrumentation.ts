export const DART_DONE_MARKER = "__RCB_DART_DONE_7f3a1b42__";
export const DART_ERROR_MARKER = "__RCB_DART_ERROR_7f3a1b42__";

interface MainDeclaration {
  nameIndex: number;
  parameters: string;
}

export function instrumentDartSource(source: string): string {
  const declaration = findTopLevelMain(source);
  if (!declaration) return source;

  const renamed = `${source.slice(0, declaration.nameIndex)}__rcbUserMain${source.slice(declaration.nameIndex + "main".length)}`;
  const parameters = declaration.parameters.trim();
  const argumentsExpression = !parameters || parameters.startsWith("[") || parameters.startsWith("{")
    ? "const <dynamic>[]"
    : "const <dynamic>[<String>[]]";

  return `${renamed}

Future<void> main() async {
  try {
    final dynamic result = Function.apply(__rcbUserMain, ${argumentsExpression});
    if (result is Future) await result;
  } catch (error, stackTrace) {
    print('${DART_ERROR_MARKER}$error\\n$stackTrace');
  } finally {
    print('${DART_DONE_MARKER}');
  }
}
`;
}

function findTopLevelMain(source: string): MainDeclaration | null {
  const declarationPattern = /\bmain\s*\(([^()]*)\)\s*(?:(?:async|sync)\s*\*?\s*)?(?=\{|=>)/gu;
  for (const match of source.matchAll(declarationPattern)) {
    const nameIndex = match.index;
    if (isTopLevelCodePosition(source, nameIndex)) {
      return { nameIndex, parameters: match[1] ?? "" };
    }
  }
  return null;
}

function isTopLevelCodePosition(source: string, targetIndex: number): boolean {
  let braceDepth = 0;
  let blockCommentDepth = 0;
  let quote = "";
  let tripleQuoted = false;

  for (let index = 0; index < targetIndex; index += 1) {
    const current = source[index] ?? "";
    const next = source[index + 1] ?? "";

    if (blockCommentDepth > 0) {
      if (current === "/" && next === "*") {
        blockCommentDepth += 1;
        index += 1;
      } else if (current === "*" && next === "/") {
        blockCommentDepth -= 1;
        index += 1;
      }
      continue;
    }

    if (quote) {
      if (current === "\\") {
        index += 1;
        continue;
      }
      if (tripleQuoted) {
        if (source.slice(index, index + 3) === quote.repeat(3)) {
          index += 2;
          quote = "";
          tripleQuoted = false;
        }
      } else if (current === quote) {
        quote = "";
      }
      continue;
    }

    if (current === "/" && next === "/") {
      const newline = source.indexOf("\n", index + 2);
      if (newline < 0 || newline >= targetIndex) return false;
      index = newline;
      continue;
    }
    if (current === "/" && next === "*") {
      blockCommentDepth = 1;
      index += 1;
      continue;
    }
    if (current === "'" || current === '"') {
      quote = current;
      tripleQuoted = source.slice(index, index + 3) === current.repeat(3);
      if (tripleQuoted) index += 2;
      continue;
    }
    if (current === "{") braceDepth += 1;
    if (current === "}") braceDepth = Math.max(0, braceDepth - 1);
  }

  return braceDepth === 0 && blockCommentDepth === 0 && !quote;
}
