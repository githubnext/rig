const arrayMethods = new Set(["map", "filter", "forEach", "find", "findIndex", "every", "some", "flatMap"]);

// Match a simple identifier (not a keyword that begins a different construct).
// "async" before an arrow must be excluded so `arr.map(async x => ...)` is not flagged.
const identifierRe = /^[A-Za-z_$][\w$]*$/;
const skipKeywords = new Set(["async", "function"]);

export function scanTokens(tokens) {
  const problems = [];

  for (let index = 0; index <= tokens.length - 6; index += 1) {
    const [dot, method, openParen, param, eq, gt] = tokens.slice(index, index + 6);

    if (
      dot.value !== "."
      || !arrayMethods.has(method.value)
      || openParen.value !== "("
      || !identifierRe.test(param.value)
      || skipKeywords.has(param.value)
      || eq.value !== "="
      || gt.value !== ">"
    ) {
      continue;
    }

    problems.push({
      start: param.start,
      end: gt.end,
      message: `Arrow callback parameter '${param.value}' has no type annotation. Under noImplicitAny, TypeScript may fail when the array element type cannot be inferred (e.g. when the handler arg is any). Add an explicit type: (${param.value}: string) => ...`,
      kind: "no-implicit-any-in-tool-handler",
      edits: [
        { start: param.start, text: "(" },
        { start: param.end, text: ")" },
      ],
    });
  }

  return problems;
}

export default {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Require explicit type annotations on unparenthesized arrow callback parameters in array method calls to prevent noImplicitAny errors",
    },
    fixable: "code",
    schema: [],
    messages: {
      noType:
        "Arrow callback parameter '{{name}}' has no type annotation. Under noImplicitAny, TypeScript may fail when the array element type cannot be inferred. Add an explicit type: ({{name}}: string) => ...",
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        const { callee, arguments: args } = node;
        if (
          callee.type !== "MemberExpression"
          || callee.computed
          || callee.property.type !== "Identifier"
          || !arrayMethods.has(callee.property.name)
        ) {
          return;
        }

        const callback = args[0];
        if (
          !callback
          || callback.type !== "ArrowFunctionExpression"
          || callback.params.length !== 1
        ) {
          return;
        }

        const [param] = callback.params;
        if (
          param.type !== "Identifier"
          || param.typeAnnotation
        ) {
          return;
        }

        context.report({
          node: param,
          messageId: "noType",
          data: { name: param.name },
          fix(fixer) {
            return fixer.replaceText(param, `(${param.name})`);
          },
        });
      },
    };
  },
};
