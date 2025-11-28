module.exports = function renameExportsPlugin({ types: t }) {
  return {
    visitor: {
      AssignmentExpression(path, state) {
        const { node, scope } = path;
        
        // 检查是否为 exports.xxx = variable 格式
        if (!isExportsAssignment(t, node)) {
          return;
        }

        const exportName = node.left.property.name;
        const localName = node.right.name;
        const binding = scope.getBinding(localName);

        if (!binding) {
          return;
        }

        // 确定目标重命名
        const targetName = getTargetName(exportName, localName, state.file.opts.filename);
        
        if (localName !== targetName) {
          renameInScope(t, path, binding, localName, targetName);
        }
      },
    },
  };
};

/**
 * 检查是否为 exports.xxx = variable 格式的赋值
 */
function isExportsAssignment(t, node) {
  return (
    t.isMemberExpression(node.left) &&
    t.isIdentifier(node.left.object, { name: "exports" }) &&
    t.isIdentifier(node.left.property) &&
    t.isIdentifier(node.right)
  );
}

/**
 * 获取目标重命名
 */
function getTargetName(exportName, localName, filename) {
  if (exportName === localName) {
    return localName;
  }
  
  if (exportName === "default") {
    return inferNameFromFilename(filename) || "DefaultExport";
  }
  
  return exportName;
}

/**
 * 在适当的作用域范围内重命名变量
 */
function renameInScope(t, exportsPath, binding, localName, targetName) {
  const lastAssignment = findLastAssignmentBefore(t, exportsPath, binding, localName);
  const nextAssignment = findNextAssignmentAfter(t, exportsPath, binding, localName);
  
  const startPos = lastAssignment ? lastAssignment.end : -1;
  const endPos = nextAssignment ? nextAssignment.start : -1;

  // 重命名最后一次赋值中的标识符
  if (lastAssignment) {
    renameAssignmentTarget(lastAssignment, targetName);
  }

  // 重命名范围内的所有引用
  const rootScope = exportsPath.scope.getBlockParent();
  rootScope.path.traverse(createRenameVisitor(binding, localName, targetName, startPos, endPos));
}

/**
 * 重命名赋值目标
 */
function renameAssignmentTarget(assignment, newName) {
  const targetNode = assignment.isAssignmentExpression 
    ? assignment.node.left 
    : assignment.node.id;
  
  if (targetNode) {
    targetNode.name = newName;
  }
}

/**
 * 创建重命名访问器
 */
function createRenameVisitor(binding, localName, targetName, startPos, endPos) {
  return {
    ReferencedIdentifier(path) {
      if (shouldRenameReference(path, binding, localName, startPos, endPos)) {
        path.node.name = targetName;
      }
    },

    Scope(path) {
      if (!path.scope.bindingIdentifierEquals(localName, binding.identifier)) {
        path.skip();
      }
    },

    "AssignmentExpression|Declaration|VariableDeclarator"(path) {
      if (path.isVariableDeclaration()) return;

      const identifiers = getIdentifiersFromPath(path, localName);
      
      for (const identifier of identifiers) {
        if (identifier === binding.identifier && 
            isInRange(identifier, startPos, endPos)) {
          identifier.name = targetName;
        }
      }
    },
  };
}

/**
 * 检查是否应该重命名引用
 */
function shouldRenameReference(path, binding, localName, startPos, endPos) {
  return (
    path.node.name === localName &&
    path.scope.getBindingIdentifier(localName) === binding.identifier &&
    isInRange(path.node, startPos, endPos)
  );
}

/**
 * 从路径中获取相关标识符
 */
function getIdentifiersFromPath(path, localName) {
  if (path.isAssignmentExpression()) {
    return getAssignmentIdentifiers(path.node, localName);
  }
  
  const identifiers = path.getOuterBindingIdentifiers();
  return Object.keys(identifiers)
    .filter(name => name === localName)
    .map(name => identifiers[name]);
}

/**
 * 获取赋值表达式中的标识符
 */
function getAssignmentIdentifiers(node, targetName) {
  if (node.left && node.left.name === targetName) {
    return [node.left];
  }
  return [];
}

/**
 * 查找 exports 语句之前的最后一次赋值
 */
function findLastAssignmentBefore(t, exportsPath, binding, localName) {
  const assignments = findAssignments(t, exportsPath, binding, localName, true);
  const topLevelAssignments = filterTopLevelAssignments(assignments);
  
  return topLevelAssignments.reduce((latest, current) => {
    return !latest || current.end > latest.end ? current : latest;
  }, null);
}

/**
 * 查找 exports 语句之后的下一次赋值
 */
function findNextAssignmentAfter(t, exportsPath, binding, localName) {
  const assignments = findAssignments(t, exportsPath, binding, localName, false);
  const topLevelAssignments = filterTopLevelAssignments(assignments);
  
  return topLevelAssignments.reduce((earliest, current) => {
    return !earliest || current.start < earliest.start ? current : earliest;
  }, null);
}

/**
 * 查找赋值语句
 */
function findAssignments(t, exportsPath, binding, localName, before) {
  const assignments = [];
  const comparePos = before ? exportsPath.node.start : exportsPath.node.end;
  const rootScope = exportsPath.scope.getBlockParent();

  rootScope.path.traverse({
    "AssignmentExpression|Declaration|VariableDeclarator"(path) {
      if (path.isVariableDeclaration()) return;
      
      const shouldInclude = before 
        ? path.node.start < comparePos 
        : path.node.start > comparePos;
        
      if (!shouldInclude) return;

      const identifier = path.isAssignmentExpression() ? path.node.left : path.node.id;
      
      if (t.isIdentifier(identifier, { name: localName }) &&
          path.scope.getBindingIdentifier(localName) === binding.identifier) {
        assignments.push({
          path,
          node: path.node,
          start: path.node.start,
          end: path.node.end,
          isAssignmentExpression: path.isAssignmentExpression(),
        });
      }
    },
  });

  return assignments;
}

/**
 * 过滤出顶层赋值语句（排除被包含的内层表达式）
 */
function filterTopLevelAssignments(assignments) {
  return assignments.filter(assignment => {
    return !assignments.some(other => 
      other !== assignment &&
      other.start <= assignment.start &&
      other.end >= assignment.end
    );
  });
}

/**
 * 检查节点是否在指定范围内
 */
function isInRange(node, startPos, endPos) {
  if (node.start === undefined) return false;
  const afterStart = startPos === -1 || node.start >= startPos;
  const beforeEnd = endPos === -1 || node.start < endPos;
  return afterStart && beforeEnd;
}

/**
 * 从文件名推测变量名
 */
function inferNameFromFilename(filename) {
  if (!filename) return null;
  
  const base = filename.split(/[\\/]/).pop();
  const name = base.replace(/\.[^/.]+$/, "");
  
  return /^[a-zA-Z_$][\w$]*$/.test(name) ? name : null;
}