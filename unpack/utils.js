const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const t = require("@babel/types");

function restoreParams(code) {
  code = "(" + code + ")";
  let ast = parser.parse(code, {});
  let funcPath;
  
  traverse(ast, {
    Program(path) {
      if (path.node.body.length !== 1) return;
      funcPath = path.get("body.0.expression");
      if (funcPath.isFunctionExpression()) {
        let params = funcPath.node.params;
        
        // 为每个参数处理重命名
        const renameMap = [
          { index: 0, newName: "require" },
          { index: 1, newName: "module" },
          { index: 2, newName: "exports" }
        ];
        
        for (let { index, newName } of renameMap) {
          if (params.length > index && !t.isIdentifier(params[index], { name: newName })) {
            const paramName = params[index].name;
            const binding = funcPath.scope.getBinding(paramName);
            if (binding) {
              renameBeforeReassignment(funcPath, binding, paramName, newName);
            }
          }
        }
      }
    },
  });
  
  return funcPath
    .get("body.body")
    .map((path) => path.toString())
    .join("\n");
}

function renameBeforeReassignment(funcPath, binding, oldName, newName) {
  // 找到第一个重新赋值的代码位置
  let reassignmentPosition = findReassignmentPosition(funcPath, binding, oldName);
  
  // 重命名所有在重新赋值之前的引用
  const renameVisitor = {
    ReferencedIdentifier(path) {
      if (path.node.name === oldName && 
          path.scope.getBindingIdentifier(oldName) === binding.identifier &&
          isBeforeReassignment(path.node, reassignmentPosition)) {
        path.node.name = newName;
      }
    },
    
    Scope(path) {
      if (!path.scope.bindingIdentifierEquals(oldName, binding.identifier)) {
        path.skip();
      }
    },
    
    "AssignmentExpression|Declaration|VariableDeclarator"(path) {
      if (path.isVariableDeclaration()) return;
      
      const ids = path.isAssignmentExpression() 
        ? getAssignmentIdentifiers(path.node)
        : path.getOuterBindingIdentifiers();
      
      for (const name in ids) {
        if (name === oldName && 
            ids[name] === binding.identifier &&
            isBeforeReassignment(ids[name], reassignmentPosition)) {
          ids[name].name = newName;
        }
      }
    }
  };
  
  funcPath.get("body").traverse(renameVisitor);
}

function findReassignmentPosition(funcPath, binding, oldName) {
  let reassignmentPosition = -1;
  
  funcPath.get("body").traverse({
    "AssignmentExpression|Declaration|VariableDeclarator"(path) {
      if (path.isVariableDeclaration()) return;
      const id = path.isAssignmentExpression() ? path.node.left : path.node.id;
      if (t.isIdentifier(id, { name: oldName }) &&
          path.scope.getBindingIdentifier(oldName) === binding.identifier) {
        reassignmentPosition = path.node.start;
        path.stop();
      }
    }
  });
  
  return reassignmentPosition;
}

function getAssignmentIdentifiers(node) {
  const ids = {};
  if (t.isIdentifier(node.left)) {
    ids[node.left.name] = node.left;
  }
  return ids;
}

function isBeforeReassignment(node, reassignmentPosition) {
  return reassignmentPosition === -1 || 
         (node.start !== undefined && node.start < reassignmentPosition);
}

module.exports = {
  restoreParams,
};