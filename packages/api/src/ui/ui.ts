// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { FxError } from "../error";
import { AnswerValue, FuncQuestion, OptionItem, StaticOption } from "../qm/question";


export interface FxUIOption{
  title: string,
  placeholder?: string;
  prompt?:string;
  step?: number;
  totalSteps?: number;
}

export interface FxSingleQuickPickOption extends FxUIOption{
  items: StaticOption;
  defaultValue?: string;
  returnObject?: boolean;
}

export interface FxMultiQuickPickOption extends FxUIOption{
  items: StaticOption;
  defaultValue?: string[];
  returnObject?: boolean;
  onDidChangeSelection?: (currentSelectedIds: Set<string>, previousSelectedIds: Set<string>) => Promise<Set<string>>;
  validation?: (input: string[]) => string|undefined|Promise<string|undefined>;
}

export interface FxInputBoxOption extends FxUIOption{
  password?: boolean;
  number?:boolean;
  defaultValue?: string;
  validation?: (input: string) => Promise<string | undefined>;
}

export interface FxFileSelectorOption extends FxUIOption{
    /**
     * The resource the dialog shows when opened.
     */
    defaultUri?: string;

    /**
     * A human-readable string for the open button.
     */
    openLabel?: string;

    /**
     * Allow to select files, defaults to `true`.
     */
    canSelectFiles?: boolean;

    /**
     * Allow to select folders, defaults to `false`.
     */
    canSelectFolders?: boolean;

    /**
     * Allow to select many files or folders.
     */
    canSelectMany?: boolean;

    /**
     * A set of file filters that are used by the dialog. Each entry is a human-readable label,
     * like "TypeScript", and an array of extensions, e.g.
     * ```ts
     * {
     *     'Images': ['png', 'jpg']
     *     'TypeScript': ['ts', 'tsx']
     * }
     * ```
     */
    filters?: { [name: string]: string[] };

    validation?: (input: string) => string | undefined | Promise<string | undefined>;
}

export enum InputResultType {
  cancel = "cancel",
  back = "back",
  sucess = "sucess",
  error = "error",
  pass = "pass" // for single select option quick pass it
}

export interface InputResult{
  type: InputResultType;
  result?: AnswerValue;
  error?: FxError;
}

export interface IProgressHandler {
  /**
   * Start this progress bar. After calling it, the progress bar will be seen to users with 
   * ${currentStep} = 0 and ${detail} = detail.
   * @param detail the detail message of the next work.
   */
  start: (detail?: string) => Promise<void>;
  
  /**
   * Update the progress bar's message. After calling it, the progress bar will be seen to 
   * users with ${currentStep}++ and ${detail} = detail.
   * This func must be called after calling start().
   * @param detail the detail message of the next work.
   */
  next: (detail?: string) => Promise<void>;
  
  /**
   * End the progress bar. After calling it, the progress bar will disappear. This handler 
   * can be reused after calling end().
   */
  end: () => Promise<void>;
}

export enum MsgLevel {
  Info = "Info",
  Warning = "Warning",
  Error = "Error",
}

export interface FxFuncQuestionOption extends FxUIOption{
  func: FuncQuestion;
}

export interface UserInterface{
  showSingleQuickPick: (option: FxSingleQuickPickOption) => Promise<InputResult> 
  showMultiQuickPick: (option: FxMultiQuickPickOption) => Promise<InputResult> 
  showInputBox: (option: FxInputBoxOption) => Promise<InputResult>;
  showFileSelector: (option: FxFileSelectorOption) => Promise<InputResult>;
  createProgressBar?: (title: string, totalSteps: number) => IProgressHandler;
  openExternal?(link: string): Promise<boolean>;
  showMessage?(level:MsgLevel, message: string, ...items: string[]): Promise<string | undefined>;
}
   
