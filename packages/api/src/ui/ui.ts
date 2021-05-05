// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { FxError } from "../error";
import { AnswerValue, FuncQuestion, OptionItem, StaticOption } from "../qm/question";


export interface FxUIOption{
  title: string,
  step?: number;
  totalSteps?: number;
}


export interface FxQuickPickOption extends FxUIOption{
  
  /**
   * select option list
   */
  items: StaticOption;
  /**
   * whether is multiple select or single select
   */
  canSelectMany: boolean;
  /**
   * The default selected `id` (for single select) or `id` array (for multiple select)
   */
  defaultValue?: string | string[];

  /**
   * placeholder text
   */
  placeholder?: string;

  /**
   * whether to return `OptionItem` or `OptionItem[]` if the items have type `OptionItem[]`
   * if the items has type `string[]`, this config will not take effect, the answer has type `string` or `string[]`
   */
  returnObject?: boolean;

  /**
   * a callback function when the select changes
   */
  onDidChangeSelection?: (currentSelectedIds: Set<string>, previousSelectedIds: Set<string>) => Promise<Set<string>>;

  validation?: (input: string[]) => Promise<string | undefined>;
}

export interface FxInputBoxOption extends FxUIOption{
  password?: boolean;
  number?:boolean;
  defaultValue?: string;
  placeholder?: string;
  prompt?: string;
  validation?: (input: string) => Promise<string | undefined>;
}

export interface FxFileOpenDialogOption extends FxUIOption{
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

    validation?: (input: string) => Promise<string | undefined>;
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
  showFuncQuestion: (option: FxFuncQuestionOption) => Promise<InputResult>;
  showQuickPick: (option: FxQuickPickOption) => Promise<InputResult> 
  showInputBox: (option: FxInputBoxOption) => Promise<InputResult>;
  showFileOpenDialog: (option: FxFileOpenDialogOption) => Promise<InputResult>;
  createProgressBar?: (title: string, totalSteps: number) => IProgressHandler;
  openExternal?(link: string): Promise<boolean>;
  showMessage?(level:MsgLevel, message: string, ...items: string[]): Promise<string | undefined>;
}
   
