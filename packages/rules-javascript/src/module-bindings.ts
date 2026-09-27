import type { NodePath } from "@babel/traverse";
import * as t from "@babel/types";

export function isNodeRequire(path: NodePath, name: string): boolean {
  const binding = path.scope.getBinding(name);
  if (binding === undefined)
    return (
      name === "require" &&
      path.scope.getProgramParent().path.getData("unsafeGlobalRequire") !== true
    );
  if (!binding.constant || binding.kind !== "const" || !binding.path.isVariableDeclarator())
    return false;
  const init = binding.path.node.init;
  if (!t.isCallExpression(init) || !t.isIdentifier(init.callee) || init.arguments.length !== 1)
    return false;
  const factory = binding.path.scope.getBinding(init.callee.name);
  if (factory === undefined || !factory.constant || !factory.path.isImportSpecifier()) return false;
  const imported = factory.path.node.imported;
  const declaration = factory.path.parent;
  if (
    !t.isIdentifier(imported, { name: "createRequire" }) ||
    !t.isImportDeclaration(declaration) ||
    !["module", "node:module"].includes(declaration.source.value)
  )
    return false;
  const arg = init.arguments[0];
  if (
    !t.isMemberExpression(arg) ||
    arg.computed ||
    !t.isIdentifier(arg.property, { name: "url" }) ||
    !t.isMetaProperty(arg.object) ||
    !t.isIdentifier(arg.object.meta, { name: "import" }) ||
    !t.isIdentifier(arg.object.property, { name: "meta" })
  )
    return false;
  return binding.referencePaths.every((reference) => {
    const parent = reference.parentPath;
    if (parent?.isCallExpression() && parent.node.callee === reference.node) return true;
    return (
      parent?.isMemberExpression() &&
      !parent.node.computed &&
      t.isIdentifier(parent.node.property, { name: "resolve" }) &&
      parent.parentPath?.isCallExpression() &&
      parent.parentPath.node.callee === parent.node
    );
  });
}

export function isPotentialRequire(path: NodePath, name: string): boolean {
  if (name === "require") return true;
  const binding = path.scope.getBinding(name);
  if (binding?.path.isVariableDeclarator() !== true) return false;
  const init = binding.path.node.init;
  if (!t.isCallExpression(init) || !t.isIdentifier(init.callee)) return false;
  const factory = binding.path.scope.getBinding(init.callee.name);
  return (
    factory?.path.isImportSpecifier() === true &&
    t.isIdentifier(factory.path.node.imported, { name: "createRequire" }) &&
    t.isImportDeclaration(factory.path.parent) &&
    ["node:module", "module"].includes(factory.path.parent.source.value)
  );
}

export function resolvedModuleAlias(
  path: NodePath,
  node: t.Node | null | undefined,
): string | undefined {
  if (!t.isIdentifier(node)) return undefined;
  const binding = path.scope.getBinding(node.name);
  if (
    binding === undefined ||
    !binding.constant ||
    binding.kind !== "const" ||
    !binding.path.isVariableDeclarator()
  )
    return undefined;
  const init = binding.path.node.init;
  if (
    !t.isCallExpression(init) ||
    !t.isMemberExpression(init.callee) ||
    init.callee.computed ||
    !t.isIdentifier(init.callee.property, { name: "resolve" }) ||
    !t.isIdentifier(init.callee.object) ||
    !isNodeRequire(binding.path, init.callee.object.name)
  )
    return undefined;
  return t.isStringLiteral(init.arguments[0]) ? init.arguments[0].value : undefined;
}
