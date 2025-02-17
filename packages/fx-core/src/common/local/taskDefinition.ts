// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
"use strict";

import { FolderName, ProgrammingLanguage, npmInstallCommand } from "./constants";
import path from "path";
import { isWindows } from "../deps-checker/util/system";

export interface ITaskDefinition {
  name: string;
  command: string;
  cwd: string | undefined;
  isBackground: boolean;
  execOptions: {
    needShell: boolean;
    needCmd?: boolean;
  };
  args?: string[];
  env?: { [key: string]: string };
}

// This type of task executes npm script of each component.
export class NpmTaskDefinition {
  private static command(isWatchTask: boolean): string {
    return isWatchTask ? "npm run watch:teamsfx" : "npm run dev:teamsfx";
  }

  private static nameSuffix(isWatchTask: boolean): string {
    return isWatchTask ? "watch" : "dev";
  }

  static frontend(workspaceFolder: string, isWatchTask: boolean): ITaskDefinition {
    return {
      name: `frontend ${NpmTaskDefinition.nameSuffix(isWatchTask)}`,
      command: NpmTaskDefinition.command(isWatchTask),
      cwd: path.join(workspaceFolder, FolderName.Frontend),
      execOptions: {
        needShell: true,
      },
      isBackground: true,
    };
  }

  static backend(
    workspaceFolder: string,
    isWatchTask: boolean,
    funcBinFolders: string[] | undefined
  ): ITaskDefinition {
    return {
      name: `backend ${NpmTaskDefinition.nameSuffix(isWatchTask)}`,
      command: NpmTaskDefinition.command(isWatchTask),
      cwd: path.join(workspaceFolder, FolderName.Function),
      execOptions: {
        needShell: true,
      },
      isBackground: true,
      env: funcBinFolders
        ? {
            // put portable func at the end since func checker prefers global func
            PATH: `${process.env.PATH ?? ""}${path.delimiter}${funcBinFolders.join(
              path.delimiter
            )}`,
          }
        : undefined,
    };
  }

  static bot(workspaceFolder: string, isWatchTask: boolean): ITaskDefinition {
    return {
      name: `bot ${NpmTaskDefinition.nameSuffix(isWatchTask)}`,
      command: NpmTaskDefinition.command(isWatchTask),
      cwd: path.join(workspaceFolder, FolderName.Bot),
      execOptions: {
        needShell: true,
      },
      isBackground: true,
    };
  }
}

export class TaskDefinition {
  static frontendStart(workspaceFolder: string): ITaskDefinition {
    return {
      name: "frontend start",
      command: "npx react-scripts start",
      cwd: path.join(workspaceFolder, FolderName.Frontend),
      execOptions: {
        needShell: true,
      },
      isBackground: true,
    };
  }

  static backendStart(
    workspaceFolder: string,
    programmingLanguage: string | undefined,
    funcCommand: string,
    enableLanguageWorker: boolean
  ): ITaskDefinition {
    // NOTE: properly handle quoting and escaping to work on windows (both powershell and cmd), linux and osx
    const languageWorkerArg = enableLanguageWorker ? `--language-worker="--inspect=9229"` : "";
    const args =
      programmingLanguage === ProgrammingLanguage.typescript
        ? `start --typescript ${languageWorkerArg} --port "7071" --cors "*"`
        : `start --javascript ${languageWorkerArg} --port "7071" --cors "*"`;
    return {
      name: "backend start",
      command: `${funcCommand} ${args}`,
      cwd: path.join(workspaceFolder, FolderName.Function),
      execOptions: {
        needShell: true,
        needCmd: isWindows(),
      },
      isBackground: true,
    };
  }

  static backendWatch(workspaceFolder: string): ITaskDefinition {
    return {
      name: "backend watch",
      command: "npx tsc --watch",
      cwd: path.join(workspaceFolder, FolderName.Function),
      execOptions: {
        needShell: true,
      },
      isBackground: true,
    };
  }

  static authStart(dotnetExecPath: string, authServicePath: string | undefined): ITaskDefinition {
    return {
      name: "auth start",
      command: dotnetExecPath,
      args: ["Microsoft.TeamsFx.SimpleAuth.dll"],
      cwd: authServicePath,
      execOptions: {
        needShell: false,
      },
      isBackground: true,
    };
  }

  static botStart(
    workspaceFolder: string,
    programmingLanguage: string | undefined,
    enableInspect: boolean
  ): ITaskDefinition {
    // TODO: tell nodemon which files to watch (depends on bot's decision)
    const inspectArg = enableInspect ? "--inspect=9239" : "";
    const command =
      programmingLanguage === ProgrammingLanguage.typescript
        ? `npx nodemon --exec node ${inspectArg} --signal SIGINT -r ts-node/register index.ts`
        : `npx nodemon ${inspectArg} --signal SIGINT index.js`;
    return {
      name: "bot start",
      command: command,
      cwd: path.join(workspaceFolder, FolderName.Bot),
      execOptions: {
        needShell: true,
      },
      isBackground: true,
    };
  }

  static ngrokStart(
    workspaceFolder: string,
    skipNgrok: boolean,
    ngrokBinFolder: string
  ): ITaskDefinition {
    return {
      name: "ngrok start",
      command: skipNgrok
        ? "echo 'Skip starting ngrok, and will use predefined bot endpoint.'"
        : "npx ngrok http 3978 --log=stdout",
      env: {
        PATH: `${ngrokBinFolder}${path.delimiter}${process.env.PATH ?? ""}`,
      },
      cwd: path.join(workspaceFolder, FolderName.Bot),
      execOptions: {
        needShell: true,
      },
      isBackground: !skipNgrok,
    };
  }

  static frontendInstall(workspaceFolder: string): ITaskDefinition {
    return {
      name: "frontend npm install",
      command: npmInstallCommand,
      cwd: path.join(workspaceFolder, FolderName.Frontend),
      execOptions: {
        needShell: true,
      },
      isBackground: false,
    };
  }

  static backendInstall(workspaceFolder: string): ITaskDefinition {
    return {
      name: "backend npm install",
      command: npmInstallCommand,
      cwd: path.join(workspaceFolder, FolderName.Function),
      execOptions: {
        needShell: true,
      },
      isBackground: false,
    };
  }

  static backendExtensionsInstall(
    workspaceFolder: string,
    dotnetExecPath: string
  ): ITaskDefinition {
    return {
      name: "backend extensions install",
      command: dotnetExecPath,
      args: ["build", "extensions.csproj", "-o", "bin", "--ignore-failed-sources"],
      cwd: path.join(workspaceFolder, FolderName.Function),
      execOptions: {
        needShell: false,
      },
      isBackground: false,
    };
  }

  static botInstall(workspaceFolder: string): ITaskDefinition {
    return {
      name: "bot npm install",
      command: npmInstallCommand,
      cwd: path.join(workspaceFolder, FolderName.Bot),
      execOptions: {
        needShell: true,
      },
      isBackground: false,
    };
  }

  static spfxInstall(workspaceFolder: string): ITaskDefinition {
    return {
      name: "spfx npm install",
      command: npmInstallCommand,
      cwd: path.join(workspaceFolder, FolderName.SPFx),
      execOptions: {
        needShell: true,
      },
      isBackground: false,
    };
  }

  static gulpCert(workspaceFolder: string): ITaskDefinition {
    const spfxRoot = path.join(workspaceFolder, FolderName.SPFx);
    return {
      name: "gulp trust-dev-cert",
      command: "node",
      args: [`${spfxRoot}/node_modules/gulp/bin/gulp.js`, "trust-dev-cert", "--no-color"],
      cwd: spfxRoot,
      execOptions: {
        needShell: false,
      },
      isBackground: false,
    };
  }

  static gulpServe(workspaceFolder: string): ITaskDefinition {
    const spfxRoot = path.join(workspaceFolder, FolderName.SPFx);
    return {
      name: "gulp serve",
      command: "node",
      args: [`${spfxRoot}/node_modules/gulp/bin/gulp.js`, "serve", "--nobrowser", "--no-color"],
      cwd: spfxRoot,
      execOptions: {
        needShell: false,
      },
      isBackground: true,
    };
  }
}
