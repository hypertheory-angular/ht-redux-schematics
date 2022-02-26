import { parseName } from "@schematics/angular/utility/parse-name";
import { relativePathToWorkspaceRoot } from "@schematics/angular/utility/paths";
import {
  apply,
  applyTemplates,
  branchAndMerge,
  chain,
  mergeWith,
  Rule,
  SchematicContext,
  template,
  Tree,
  url,
} from "@angular-devkit/schematics";
import {} from "@angular-devkit/schematics/tools/";
import { Schema } from "./schema";
import * as ts from "typescript";
import {
  addImportToModule,
  Change,
  InsertChange,
  insertImport,
  stringUtils,
  visitNgModuleImports,
} from "../schematics-core";
import { buildRelativePath } from "../schematics-core/utility/find-component";
import { dasherize } from "@angular-devkit/core/src/utils/strings";

// You don't have to export the function as default. You can also have more than one rule factory
// per file.
export function rootState(_options: Schema): Rule {
  return (tree: Tree, _context: SchematicContext) => {
    const templateSource = apply(url("./files"), [
      template({
        ..._options,
        ...stringUtils,
      }),
    ]);

    return chain([
      branchAndMerge(
        chain([addToRootModule(_options), mergeWith(templateSource)])
      ),
    ])(tree, _context);
  };
}

function addToRootModule(options: Schema): Rule {
  return (host: Tree) => {
    if (!options.addToAppModule) {
      return host;
    }
    const modulePath = "/src/app/app.module.ts";
    const text = host.read(modulePath) || "";
    const sourceText = text?.toString("utf-8");
    const source = ts.createSourceFile(
      modulePath,
      sourceText,
      ts.ScriptTarget.Latest,
      true
    );
    const relativePath = buildRelativePath(
      modulePath,
      `/src/app/${dasherize(options.stateFolderName)}`
    );
    const storeNgModuleImport = addImportToModule(
      source,
      modulePath,
      `StoreModule.forRoot(reducers)`,
      relativePath
    ).shift();

    let commonInports = [
      insertImport(source, modulePath, "StoreModule", "@ngrx/store"),
      insertImport(source, modulePath, "reducers", relativePath),
      storeNgModuleImport,
    ];

    let rootImports: (Change | undefined)[] = [];
    let hasImports = false;
    visitNgModuleImports(source, (_, importNodes) => {
      hasImports = importNodes.length > 0;
    });

    const adjectiveComma = hasImports ? "" : ", ";

    const changes = [...commonInports, ...rootImports];
    const recorder = host.beginUpdate(modulePath);
    for (const change of changes) {
      if (change instanceof InsertChange) {
        recorder.insertLeft(change.pos, change.toAdd);
      }
    }
    host.commitUpdate(recorder);
    return host;
  };
}
