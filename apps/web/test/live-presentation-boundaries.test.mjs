import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const require = createRequire(new URL("../package.json", import.meta.url));
const ts = require("typescript");
const root = fileURLToPath(new URL("../src/", import.meta.url));
function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((item) => {
    const file = path.join(directory, item.name);
    return item.isDirectory()
      ? files(file)
      : /\.tsx?$/.test(file)
        ? [file]
        : [];
  });
}
function imports(file) {
  const tree = ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const result = [];
  function visit(node) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    )
      result.push(node.moduleSpecifier.text);
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0])
    )
      result.push(node.arguments[0].text);
    ts.forEachChild(node, visit);
  }
  visit(tree);
  return result;
}
function resolve(from, name) {
  const base = name.startsWith("@/")
    ? path.join(root, name.slice(2))
    : name.startsWith(".")
      ? path.resolve(path.dirname(from), name)
      : null;
  if (!base) return null;
  return [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, "index.ts"),
    path.join(base, "index.tsx"),
  ].find(
    (candidate) =>
      existsSync(candidate) &&
      statSync(candidate).isFile() &&
      /\.tsx?$/.test(candidate),
  );
}
for (const surface of ["app", "superadmin"]) {
  test(`live ${surface} import graph excludes synthetic preview sources`, () => {
    const pending = files(path.join(root, "app", surface));
    const visited = new Set();
    while (pending.length) {
      const file = pending.pop();
      if (visited.has(file)) continue;
      visited.add(file);
      const relative = path.relative(root, file).replaceAll(path.sep, "/");
      assert.ok(
        !/(?:^|\/)previews\//.test(relative) &&
          !/(?:^|\/)fixtures\.tsx?$/.test(relative) &&
          !relative.endsWith("platform/platform-preview.tsx"),
        `Synthetic source reached from live route: ${relative}`,
      );
      for (const name of imports(file)) {
        const dependency = resolve(file, name);
        if (dependency) pending.push(dependency);
      }
    }
    assert.ok(
      visited.size > 10,
      "must check transitive shared/feature modules, not only route files",
    );
  });
}
test("shared metric/record presentation contains no data access or fixture import", () => {
  for (const name of ["metric-card.tsx", "record-identity.tsx"]) {
    const file = path.join(root, "components/data-display", name);
    for (const dependency of imports(file))
      assert.ok(
        !/fixtures|previews|supabase|lib\/api|features\//.test(dependency),
        `${name} must remain data-free presentation`,
      );
  }
});
