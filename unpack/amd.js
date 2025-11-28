const parser = require("@babel/parser");
const t = require("@babel/types");
const { restoreParams } = require("./utils");

function isAmdBundle(body) {
  const requireFileSuffix = [".js", ".ts"];

  for (const node of body) {
    if (
      t.isExpressionStatement(node) &&
      t.isCallExpression(node.expression) &&
      t.isIdentifier(node.expression.callee, { name: "define" })
    ) {
      const args = node.expression.arguments;
      if (
        args.length === 2 &&
        t.isStringLiteral(args[0]) &&
        t.isFunctionExpression(args[1])
      ) {
        const id = args[0].value;
        if (requireFileSuffix.some((suffix) => id.endsWith(suffix))) {
          return true;
        }
      }
    }
  }

  return false;
}

function unpackAmd(code) {
  const ast = parser.parse(code, {});
  const body = ast.program.body;
  const modules = [];
  for (const node of body) {
    if (
      t.isExpressionStatement(node) &&
      t.isCallExpression(node.expression) &&
      t.isIdentifier(node.expression.callee, { name: "define" })
    ) {
      const args = node.expression.arguments;
      if (
        args.length === 2 &&
        t.isStringLiteral(args[0]) &&
        t.isFunctionExpression(args[1])
      ) {
        const id = args[0].value;
        if (!id.endsWith(".js") && !id.endsWith(".ts")) continue;
        const funcNode = args[1];
        const rawCode = code.slice(funcNode.start, funcNode.end);
        const restored = restoreParams(rawCode);

        modules.push({
          path: id,
          source: restored
        });
      }
    }
  }

  return modules;
}

module.exports = {
  isAmdBundle,
  unpackAmd,
};
