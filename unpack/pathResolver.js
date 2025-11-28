const path = require("path");

// Node class represents a file or directory in the tree
class Node {
  constructor(id, name = "", isFile = false, isPlaceholder = false) {
    this.id = String(id);
    this.parent = null;
    this.children = new Map(); // Stores child nodes by their id
    this.name = String(name);
    this.isFile = isFile;
    this.isPlaceholder = isPlaceholder; // Indicates if the node is a placeholder
  }

  // Get the absolute path of the node
  getAbsolutePath() {
    const name = this.isPlaceholder ? compressParentPathName(this.name) : this.name;
    if (this.parent) {
      return path.posix.join(this.parent.getAbsolutePath(), name);
    } else {
      return name;
    }
  }
}

function compressParentPathName(name) {
  const parts = name.split("-");
  const last = parts[parts.length - 1];

  let i = 0;
  while (i < parts.length - 1 && parts[i] === "parent") {
    i++;
  }

  if (i >= 2 && i === parts.length - 1) {
    return `parent${i}-${last}`;
  }

  return name; // 如果不满足格式要求，返回原字符串
}

// FileTree class manages the nodes and their relationships
class FileTree {
  constructor() {
    this.nodes = new Map(); // Stores nodes by their id
  }

  // Check if a node exists
  hasNode(id) {
    id = String(id);
    return this.nodes.has(id);
  }

  // Add a node to the tree
  addNode(id, name = "", isFile = false, isPlaceholder = false) {
    id = String(id);
    name = String(name);
    if (!id) {
      throw new Error(`Invalid id: ${id}`);
    }
    if (this.nodes.has(id)) {
      throw new Error(`Node with id ${id} already exists`);
    }
    const newNode = new Node(id, name, isFile, isPlaceholder);
    this.nodes.set(id, newNode);
    return newNode;
  }

  // Add a file node
  addFile(id, name, isPlaceholder = false) {
    return this.addNode(id, name, true, isPlaceholder);
  }

  // Add a directory node
  addDirectory(id, name, isPlaceholder = false) {
    return this.addNode(id, name, false, isPlaceholder);
  }

  // Add a parent directory for a given child node
  addParentDirectory(childNode, name = "") {
    const id = `parent-${childNode.id}`;
    const isPlaceholder = name === "";
    if (isPlaceholder) name = id;
    const parentNode = this.addDirectory(id, name, isPlaceholder);
    childNode.parent = parentNode;
    parentNode.children.set(childNode.id, childNode);
    return parentNode;
  }

  mergePaths(branch1Node, branch2Node) {
    // Merge the two paths
    while (
      branch1Node.parent &&
      branch2Node.parent &&
      branch1Node.parent !== branch2Node.parent
    ) {
      const p1 = branch1Node.parent;
      const p2 = branch2Node.parent;

      let mainNode;
      let tmpNode;

      // 1) 优先采用非占位目录作为主节点
      if (p1.isPlaceholder && !p2.isPlaceholder) {
        mainNode = p2;
        tmpNode = p1;
      } else if (!p1.isPlaceholder && p2.isPlaceholder) {
        mainNode = p1;
        tmpNode = p2;
      } else if (p1.isPlaceholder && p2.isPlaceholder) {
        // 2) 双方都是占位目录时，选择“更短”的占位名称作为主节点
        const name1 = compressParentPathName(p1.name);
        const name2 = compressParentPathName(p2.name);
        if (name1.length <= name2.length) {
          mainNode = p1;
          tmpNode = p2;
        } else {
          mainNode = p2;
          tmpNode = p1;
        }
      } else {
        // 3) 双方都是确定目录名：
        //    - 如果名字相同，视为同一目录层级，按深度选择一个主节点即可（无需视为冲突）
        //    - 如果名字不同，再按深度选择主节点并输出冲突日志
        const depth1 = this._getDepth(p1);
        const depth2 = this._getDepth(p2);
        if (depth1 <= depth2) {
          mainNode = p1;
          tmpNode = p2;
        } else {
          mainNode = p2;
          tmpNode = p1;
        }
        if (p1.name !== p2.name) {
          console.error(
            `Conflicting parent paths: ${p1.name} vs ${p2.name}, merged into ${mainNode.name}`
          );
        }
      }

      // 向上推进一层，继续尝试合并更高层级的父目录
      branch1Node = p1;
      branch2Node = p2;

      // Merge the child nodes
      for (const childNode of tmpNode.children.values()) {
        // TODO: There may be a conflict if the different child nodes have the same name
        if (!mainNode.children.has(childNode.id)) {
          childNode.parent = mainNode;
          mainNode.children.set(childNode.id, childNode);
        }
      }
    }

    // Same parent
    if (branch1Node.parent && branch2Node.parent) {
      return;
    }

    let parentNode, childNode;
    if (!branch1Node.parent) {
      if (!branch2Node.parent) {
        this.addParentDirectory(branch2Node);
      }
      parentNode = branch2Node.parent;
      childNode = branch1Node;
    } else {
      parentNode = branch1Node.parent;
      childNode = branch2Node;
    }
    childNode.parent = parentNode;
    parentNode.children.set(childNode.id, childNode);
  }

  // 计算节点到根的层级深度
  _getDepth(node) {
    let depth = 0;
    let cur = node;
    while (cur) {
      depth += 1;
      cur = cur.parent;
    }
    return depth;
  }

  // Get the absolute path of a node by its id
  getNodeAbsolutePath(id) {
    id = String(id);
    const node = this.nodes.get(id);
    if (!node) {
      throw new Error(`Node with id ${id} does not exist`);
    }
    return node.getAbsolutePath();
  }

  // TODO: Consider the levels of the nodes
  // Parse the require path and update the tree structure
  parseRequirePath(currentFileId, requireFileId, requirePath) {
    currentFileId = String(currentFileId);
    requireFileId = String(requireFileId);
    requirePath = String(requirePath);
    const isRelativeRequire = requirePath.startsWith(".");
    if (!requirePath || requirePath.endsWith("/")) {
      throw new Error("Invalid require path: " + requirePath);
    }
    if (!requireFileId) {
      throw new Error("Invalid require file id:" + requireFileId);
    }
    const normalizedRequirePath = path.posix.normalize(requirePath); // 使用 posix 保证路径一致性
    const segments = normalizedRequirePath.split("/");

    // Process the require file
    const requireFileName = segments.pop();
    if (!this.nodes.has(requireFileId)) {
      this.addFile(requireFileId, requireFileName);
    }
    const requireNode = this.nodes.get(requireFileId);
    if (requireNode.isPlaceholder) {
      requireNode.name = requireFileName;
      requireNode.isPlaceholder = false;
    } else if (requireNode.name !== requireFileName) {
      // 同一个 id 被不同文件名引用，视为别名冲突：
      // 保留第一次确定下来的文件名，继续使用已有节点参与路径合并，
      // 但不再尝试用新文件名覆盖，避免整条依赖被丢弃。
      console.debug(`currentFileId: ${currentFileId}`);
      console.debug(`requireFileId: ${requireFileId}`);
      console.debug(`requirePath: ${requirePath}`);
      console.error(
        `Conflicting file names for id ${requireFileId}: ${requireNode.name} and ${requireFileName}`
      );
      // 直接继续向下执行，使用已有的 requireNode/name 参与后续路径构建
    }

    // Construct the require file's path
    let childNode = requireNode;
    while (segments.length > 0) {
      const segment = segments.pop();
      if (segment === "." || segment === "..") {
        segments.push(segment);
        break;
      } else {
        if (childNode.parent) {
          if (childNode.parent.isPlaceholder) {
            childNode.parent.name = segment;
            childNode.parent.isPlaceholder = false;
          } else if (childNode.parent.name !== segment) {
            // 目录名冲突时，不再抛异常中断整条依赖。
            // 已经存在的父节点路径视为“更可信”，当前这条依赖的
            // 目录信息丢弃掉，仅保留已存在的路径结构。
            console.error(
              `Conflicting directory names for node ${childNode.id}: ${childNode.parent.name} and ${segment}`
            );
            // 清空剩余的目录 segment，终止本次向上的目录扩展。
            segments.length = 0;
            break;
          }
        } else {
          this.addParentDirectory(childNode, segment);
        }
        childNode = childNode.parent;
      }
    }

    const branch1Node = childNode;

    // 对于非相对路径（不以 . 开头）且没有剩余 ../ 信息，保持原有行为：视为“绝对路径”，不与当前文件路径合并
    // 对于 ./foo 这类相对路径，segments 为空但仍应与当前文件处于同一目录层级，因此继续向下处理。
    if (segments.length === 0 && !isRelativeRequire) {
      return;
    }

    // Process the current file
    if (!this.nodes.has(currentFileId)) {
      this.addFile(currentFileId, currentFileId, true);
    }
    const currentNode = this.nodes.get(currentFileId);

    // Construct the current file's path
    childNode = currentNode;
    while (segments.length > 0) {
      const segment = segments.shift();
      if (segment === ".") {
        continue;
      } else if (segment === "..") {
        if (!childNode.parent) {
          this.addParentDirectory(childNode);
        }
        childNode = childNode.parent;
      } else {
        throw new Error("Invalid require path: " + requirePath);
      }
    }

    let branch2Node = childNode;

    // Merge the two paths
    this.mergePaths(branch1Node, branch2Node);
  }
}

module.exports = { Node, FileTree };
