// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { FxError } from "../error";
import { AnswerValue, OptionItem, StaticOption } from "../qm/question";

 

export interface FxQuickPickOption {
  /**
   * title text of the QuickPick
   */
  title: string;
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
   * whether enable `go back` button
   */
  backButton?: boolean;

  /**
   * whether to return `OptionItem` or `OptionItem[]` if the items have type `OptionItem[]`
   * if the items has type `string[]`, this config will not take effect, the answer has type `string` or `string[]`
   */
  returnObject?: boolean;

  /**
   * a callback function when the select changes
   */
   onDidChangeSelection?: (currentSelectedIds: Set<string>, previousSelectedIds: Set<string>) => Promise<Set<string>>;
}

export interface FxInputBoxOption {
  title: string;
  password: boolean;
  defaultValue?: string;
  placeholder?: string;
  prompt?: string;
  validation?: (input: string) => Promise<string | undefined>;
  backButton?: boolean;
  number?:boolean;
}

export interface FxOpenDialogOption{
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

    /**
     * Dialog title.
     *
     * This parameter might be ignored, as not all operating systems display a title on open dialogs
     * (for example, macOS).
     */
    title?: string;

    validation?: (input: string) => Promise<string | undefined>;

    backButton?: boolean;
    step?: number;
    totalSteps?: number;
}

export enum InputResultType {
  cancel = "cancel",
  back = "back",
  sucess = "sucess",
  error = "error",
  pass = "pass" // for single select option quick pass it
}

export interface InputResult {
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

export interface UserInterface{
  showQuickPick: (option: FxQuickPickOption) => Promise<InputResult> 
  showInputBox: (option: FxInputBoxOption) => Promise<InputResult>;
  showFileOpenDialog: (option: FxOpenDialogOption) => Promise<InputResult>;
  createProgressBar?: (title: string, totalSteps: number) => IProgressHandler;
  openExternal?(link: string): Promise<boolean>;
  showMessage?(level:MsgLevel, message: string, ...items: string[]): Promise<string | undefined>;
}
   
