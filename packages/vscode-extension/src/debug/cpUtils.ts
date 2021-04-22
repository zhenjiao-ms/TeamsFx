/* eslint-disable @typescript-eslint/no-namespace */
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as cp from "child_process";
import * as os from "os";
import { CheckerLogger } from "./depsChecker/checkerAdapter";
import * as sudo from "sudo-prompt";

export namespace cpUtils {
  export async function executeCommand(
    workingDirectory: string | undefined,
    logger: CheckerLogger | undefined,
    options: cp.SpawnOptions | undefined,
    command: string,
    ...args: string[]
  ): Promise<string> {
    const result: ICommandResult = await tryExecuteCommand(
      workingDirectory,
      logger,
      options,
      command,
      ...args
    );
    if (result.code !== 0) {
      await logger?.debug(
        `Failed to run command: "${command} ${result.formattedArgs}", code: '${result.code}'`
      );
      throw new Error(`Failed to run "${command}" command. Check output window for more details.`);
    } else {
      await logger?.debug(`Finished running command: "${command} ${result.formattedArgs}".`);
    }

    return result.cmdOutput;
  }

  export async function tryExecuteCommand(
    workingDirectory: string | undefined,
    logger: CheckerLogger | undefined,
    additionalOptions: cp.SpawnOptions | undefined,
    command: string,
    ...args: string[]
  ): Promise<ICommandResult> {
    return await new Promise(
      (resolve: (res: ICommandResult) => void, reject: (e: Error) => void): void => {
        let cmdOutput = "";
        let cmdOutputIncludingStderr = "";
        const formattedArgs: string = args.join(" ");

        workingDirectory = workingDirectory || os.tmpdir();
        const options: cp.SpawnOptions = {
          cwd: workingDirectory,
          shell: true
        };
        Object.assign(options, additionalOptions);

        const childProc: cp.ChildProcess = cp.spawn(command, args, options);
        if (options.timeout && options.timeout > 0) {
          // timeout only exists for exec not spawn
          setTimeout(() => {
            childProc.kill();
            logger?.debug(
              `Stop exec due to timeout, command: "${command} ${formattedArgs}", options = '${options}'`
            );
            reject(
              new Error(
                `Exec command: "${command} ${formattedArgs}" timeout, ${options.timeout} ms`
              )
            );
          }, options.timeout);
        }
        logger?.debug(`Running command: "${command} ${formattedArgs}", options = '${options}'`);

        childProc.stdout?.on("data", (data: string | Buffer) => {
          data = data.toString();
          cmdOutput = cmdOutput.concat(data);
          cmdOutputIncludingStderr = cmdOutputIncludingStderr.concat(data);
        });

        childProc.stderr?.on("data", (data: string | Buffer) => {
          data = data.toString();
          cmdOutputIncludingStderr = cmdOutputIncludingStderr.concat(data);
        });

        childProc.on("error", (error) => {
          logger?.debug(
            `Failed to run command '${command} ${formattedArgs}': cmdOutputIncludingStderr: '${cmdOutputIncludingStderr}', error: ${error}`
          );
          reject(error);
        });
        childProc.on("close", (code: number) => {
          logger?.debug(
            `Command finished with outputs, cmdOutputIncludingStderr: '${cmdOutputIncludingStderr}'`
          );
          resolve({
            code,
            cmdOutput,
            cmdOutputIncludingStderr,
            formattedArgs
          });
        });
      }
    );
  }

  export interface ICommandResult {
    code: number;
    cmdOutput: string;
    cmdOutputIncludingStderr: string;
    formattedArgs: string;
  }

  const quotationMark: string = process.platform === "win32" ? "\"" : "'";
  /**
   * Ensures spaces and special characters (most notably $) are preserved
   */
  export function wrapArgInQuotes(arg: string): string {
    return quotationMark + arg + quotationMark;
  }

  /**
   * Run sudo command and return stdout content.
   * Note: the return value may contains EOL.
   */
  export function execSudo(logger: CheckerLogger, command: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      try {
        sudo.exec(command, { name: "TeamsFx Toolkit" }, (error, stdout, stderr) => {
          logger.debug(
            `Running execSudo, command: '${command}', error: '${error}', stdout: '${stdout}', stderr: '${stderr}'`
          );

          if (error) {
            reject(error);
          }

          if (stdout) {
            resolve(stdout.toString());
          } else {
            resolve("");
          }
        });
      } catch (error) {
        logger.debug(`Failed to run execSudo, command: '${command}', error: '${error}'`);
        reject(error);
      }
    });
  }

  /**
   * timeout with millisecond
   */
  export function withTimeout(millis: number, promise: Promise<any>, msg: string): Promise<any> {
    return Promise.race([
      promise,
      new Promise((resolve, reject) => setTimeout(() => reject(`${msg}, ${millis} ms`), millis))
    ]);
  }
}
