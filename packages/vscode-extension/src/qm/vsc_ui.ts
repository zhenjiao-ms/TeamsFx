// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
 
import { Disposable, InputBox, QuickInputButton, QuickInputButtons, QuickPick, QuickPickItem, Uri, window } from "vscode";
import { FxFileSelectorOption, FxInputBoxOption, FxMultiQuickPickOption, FxSingleQuickPickOption, InputResult, InputResultType, OptionItem, returnSystemError, UserInterface } from "fx-api";
import { ExtensionErrors, ExtensionSource } from "../error";
import { ext } from "../extensionVariables";

export interface FxQuickPickItem extends QuickPickItem {
  id: string;
  data?: unknown;
}

export class FxQuickPickItemImpl implements FxQuickPickItem {
  id: string;
  data?: unknown;
  label: string;
  description?: string | undefined;
  detail?: string | undefined;
  alwaysShow?: boolean | undefined;
  picked: boolean;
  rawLabel: string;

  constructor(option: string | OptionItem){
      if(typeof option === "string"){
          this.id = option;
          this.label = option;
          this.rawLabel = option;
          this.picked = false;
      }
      else {
          const item = option as OptionItem;
          this.id = item.id;
          this.label = item.label;
          this.description = item.description;
          this.detail = item.detail;
          this.rawLabel = item.label;
          this.data = item.data;
          this.picked = false;
      }
  }

  getOptionItem():OptionItem{
      return {
          id: this.id,
          label: this.rawLabel,
          description: this.description,
          detail: this.detail,
          data: this.data
      }
  }

  click(){
      this.picked = !this.picked;
      this.label = (this.picked === true ? "$(check) " : " ") + this.rawLabel; 
  }

  check(){
      this.picked = true;
      this.label = "$(check) " + this.rawLabel; 
  }

  uncheck(){
      this.picked = false;
      this.label = " " + this.rawLabel; 
  }
}

function toIdSet(items: ({id:string}|string)[]) : Set<string>{
  const set = new Set<string>();
  for(const i of items){
    if(typeof i === "string")
      set.add(i);
    else 
      set.add(i.id);
  }
  return set;
}

function isSame(set1: Set<string>, set2: Set<string>):boolean{
  for(const i of set1){
    if(!set2.has(i)) return false;
  }
  for(const i of set2){
    if(!set1.has(i)) return false;
  }
  return true;
}

export class VsCodeUI implements UserInterface{
  
  showSteps = false;

  async showSingleQuickPick (option: FxSingleQuickPickOption) : Promise<InputResult>{
    if(option.items.length === 0){
      return {
        type: InputResultType.error,
        error: returnSystemError(new Error("select option is empty"), ExtensionSource, ExtensionErrors.EmptySelectOption)
      };
    }
    const okButton : QuickInputButton = { 
      iconPath: Uri.file(ext.context.asAbsolutePath("media/ok.svg")),
      tooltip:"ok"
    };  
    const disposables: Disposable[] = [];
    try {
      const quickPick = window.createQuickPick<FxQuickPickItemImpl>();
      quickPick.title = option.title;
      if (option.step && option.step > 1) quickPick.buttons = [QuickInputButtons.Back, okButton];
      else quickPick.buttons = [okButton];
      quickPick.placeholder = option.placeholder;
      quickPick.ignoreFocusOut = false;
      quickPick.matchOnDescription = true;
      quickPick.matchOnDetail = true;
      quickPick.canSelectMany = false;
      if(this.showSteps){
        quickPick.step = option.step;
        quickPick.totalSteps = option.totalSteps;
      }
      return await new Promise<InputResult>(
        async (resolve): Promise<void> => {
          const onDidAccept = async () => {
            let selectedItems = quickPick.selectedItems;
            if(!selectedItems || selectedItems.length === 0) selectedItems = [quickPick.items[0]];
            const item = selectedItems[0];
            let result:string|OptionItem;
            if(typeof option.items[0] === "string" || option.returnObject === undefined || option.returnObject === false) 
              result = item.id;
            else 
              result = item.getOptionItem();
            resolve({ type: InputResultType.sucess, result: result});
          };
          disposables.push(
            quickPick.onDidAccept(onDidAccept),
            quickPick.onDidHide(() => {
              resolve({ type: InputResultType.cancel});
            }),
            quickPick.onDidTriggerButton((button) => { 
              if (button === QuickInputButtons.Back)
                resolve({ type: InputResultType.back });
              else
                onDidAccept();
            })
          );
          // set items
          quickPick.items = option.items.map((i:string|OptionItem)=>new FxQuickPickItemImpl(i));
          const optionMap = new Map<string, FxQuickPickItemImpl>();
          for(const item of quickPick.items){
            optionMap.set(item.id, item);
          }
          /// set default
          if (option.defaultValue) {
            const defaultItem = optionMap.get(option.defaultValue);
            if(defaultItem){
              const newitems = quickPick.items.filter((i) => i.id !== option.defaultValue);
              newitems.unshift(defaultItem);
              quickPick.items = newitems;
            }
          } 
          disposables.push(quickPick);
          quickPick.show();
        }
      );
    } finally {
      disposables.forEach((d) => {
        d.dispose();
      });
    }
  }

  async showMultiQuickPick (option: FxMultiQuickPickOption) : Promise<InputResult>{
    const okButton : QuickInputButton = { 
      iconPath: Uri.file(ext.context.asAbsolutePath("media/ok.svg")),
      tooltip:"ok"
    };  
    const disposables: Disposable[] = [];
    try {
        const quickPick = window.createQuickPick<FxQuickPickItemImpl>();
        quickPick.title = option.title;
        if (option.step && option.step > 1) quickPick.buttons = [QuickInputButtons.Back, okButton];
        else quickPick.buttons = [okButton];
        quickPick.placeholder = option.placeholder;
        quickPick.ignoreFocusOut = false;
        quickPick.matchOnDescription = true;
        quickPick.matchOnDetail = true;
        quickPick.canSelectMany = false;
        if(this.showSteps){
          quickPick.step = option.step;
          quickPick.totalSteps = option.totalSteps;
        }
        
        let selectNum = option.defaultValue? (option.defaultValue).length : 0;
        const firstItem =  new FxQuickPickItemImpl({
            description: "",
            detail: `${option.prompt?(option.prompt+", p"):"P"}ress <Enter> to continue, press <Alt+LeftArrow> to go back. `,
            id: "",
            label: `$(checklist) Selected ${selectNum} item${selectNum > 1 ? 's':''}`,
        });
        let prevIds = new Set<string>();
        return await new Promise<InputResult>(
        async (resolve): Promise<void> => {
            const onDidAccept = async () => {
                const item = quickPick.selectedItems[0];
                if(item === undefined || item === firstItem){
                    const selectedItems = quickPick.items.filter(i=>i.picked);
                    const strArray = Array.from(selectedItems.map((i) => i.id));
                    if(option.validation){
                        const validateRes = await option.validation(strArray);
                        if(validateRes){
                            return ;
                        }
                    }
                    if(option.returnObject) resolve({ type: InputResultType.sucess, result: selectedItems.map(i=>i.getOptionItem())});
                    else resolve({ type: InputResultType.sucess, result: selectedItems.map(i=>i.id)});
                }
                item.click();
                if(option.onDidChangeSelection){
                    const currentIds = new Set<string>();
                    for(let i = 1; i < quickPick.items.length; ++ i){
                      const item = quickPick.items[i];
                      if(item.picked)
                        currentIds.add(item.id);
                    }
                    const newIds = await option.onDidChangeSelection(currentIds, prevIds);
                    for(let i = 1; i < quickPick.items.length; ++ i){
                      const item = quickPick.items[i];
                      if(newIds.has(item.id))
                        item.check();
                      else 
                        item.uncheck();
                    }
                    prevIds = newIds;
                }
                selectNum = prevIds.size;
                firstItem.label = `$(checklist) Selected ${selectNum} item${selectNum > 1 ? 's':''}`;
                quickPick.items = quickPick.items;
            };

            disposables.push(
              quickPick.onDidAccept(onDidAccept),
              quickPick.onDidHide(() => {
                  resolve({ type: InputResultType.cancel});
              }),
              quickPick.onDidTriggerButton((button) => { 
                if (button === QuickInputButtons.Back)
                  resolve({ type: InputResultType.back });
                else
                  onDidAccept();
              })
            );

            // set items
            const items:FxQuickPickItemImpl[] = [firstItem]; 
            option.items.forEach((element: string | OptionItem) => {
                items.push(new FxQuickPickItemImpl(element))
            });
            // default
            if (option.defaultValue) {
                const ids = option.defaultValue as string[];
                items.forEach(i=>{
                    if(ids.includes(i.id)){
                        i.check();
                    }
                });
                for(const id of option.defaultValue) prevIds.add(id);
            }
            quickPick.items = items; 
            disposables.push(quickPick);
            quickPick.show();
        }
        );
    } finally {
        disposables.forEach((d) => {
            d.dispose();
        });
    }
  }

  async showInputBox(option: FxInputBoxOption) : Promise<InputResult>{
    const okButton : QuickInputButton = { 
      iconPath: Uri.file(ext.context.asAbsolutePath("media/ok.svg")),
      tooltip:"ok"
    };  
    const disposables: Disposable[] = [];
    try {
      const inputBox: InputBox = window.createInputBox();
      inputBox.title = option.title;
      if (option.step && option.step > 1) inputBox.buttons = [QuickInputButtons.Back, okButton];
      else inputBox.buttons = [okButton];
      inputBox.placeholder = option.placeholder;
      inputBox.value = option.defaultValue || "";
      inputBox.ignoreFocusOut = false;
      inputBox.password = option.password === true;
      inputBox.prompt = option.prompt;
      if(this.showSteps){
        inputBox.step = option.step;
        inputBox.totalSteps = option.totalSteps;
      }
      if(option.number){
        const numberValidation = async function(input:string):Promise<string|undefined>{
          if(!input || input.trim() === "" ||isNaN(Number(input))) return `'${input}' is not a valid number`;
          return undefined;
        };
        const oldValidation = option.validation;
        const newValidation = async function(input:string):Promise<string|undefined>{
          const res = oldValidation ? await oldValidation(input): undefined;
          if(res !== undefined) return res;
          return await numberValidation(input);
        };
        option.validation = newValidation;
      }
      return await new Promise<InputResult>((resolve): void => {
        const onDidAccept = async () => {
          const validationRes = option.validation ? await option.validation(inputBox.value) : undefined;
          if (!validationRes) {
            resolve({ type: InputResultType.sucess, result: inputBox.value });
          } else {
            inputBox.validationMessage = validationRes;
          }
        };
        disposables.push(
          inputBox.onDidChangeValue(async (text) => {
            if (option.validation) {
              const validationRes = option.validation ? await option.validation(text) : undefined;
              if (!!validationRes) {
                inputBox.validationMessage = validationRes;
              }
              else{
                inputBox.validationMessage = undefined;
              }
            }
          }),
          inputBox.onDidAccept(onDidAccept),
          inputBox.onDidHide(() => {
            resolve({ type: InputResultType.cancel });
          }),
          inputBox.onDidTriggerButton((button) => { 
            if (button === QuickInputButtons.Back)
              resolve({ type: InputResultType.back });
            else
              onDidAccept();
          })
        );
        disposables.push(inputBox);
        inputBox.show();
      });
    } finally {
      disposables.forEach((d) => {
        d.dispose();
      });
    }
  }
  
  async showFileSelector (option: FxFileSelectorOption):Promise<InputResult>{
    const okButton : QuickInputButton = { 
      iconPath: Uri.file(ext.context.asAbsolutePath("media/ok.svg")),
      tooltip:"ok"
    };  
    const disposables: Disposable[] = [];
    try {
      const quickPick: QuickPick<QuickPickItem> = window.createQuickPick();
      quickPick.title = option.title;
      if (option.step && option.step > 1) quickPick.buttons = [QuickInputButtons.Back, okButton];
      else quickPick.buttons = [okButton];
      quickPick.ignoreFocusOut = true;
      quickPick.placeholder = option.placeholder;
      quickPick.matchOnDescription = false;
      quickPick.matchOnDetail = false;
      quickPick.canSelectMany = false;
      if(this.showSteps){
        quickPick.step = option.step;
        quickPick.totalSteps = option.totalSteps;
      }
      return await new Promise<InputResult>(
        async (resolve): Promise<void> => {
          const onDidAccept = async () => {
            const result = quickPick.items[0].detail;
            if(result && result.length > 0)
              resolve({ type: InputResultType.sucess, result: result });
          };

          disposables.push(
            quickPick.onDidHide(() => {
              resolve({ type: InputResultType.cancel});
            }),
            quickPick.onDidTriggerButton((button) => { 
              if (button === QuickInputButtons.Back)
                resolve({ type: InputResultType.back });
              else
                onDidAccept();
            })
          );

          /// set items
          quickPick.items = [{label: option.prompt || "Select folder", detail: option.defaultUri}];
          const onDidChangeSelection = async function(items:QuickPickItem[]):Promise<any>{
            const defaultUrl = items[0].detail;
            const uri = await window.showOpenDialog({
              defaultUri: defaultUrl ? Uri.file(defaultUrl) : undefined,
              canSelectFiles: false,
              canSelectFolders: true,
              canSelectMany: false,
              title: option.title
            });
            const res = uri && uri.length > 0 ? uri[0].fsPath : undefined;
            if (res) {
              quickPick.items = [{label: option.prompt || "Select folder", detail: res}];
              resolve({ type: InputResultType.sucess, result: res });
            }
          };
          disposables.push(
            quickPick.onDidChangeSelection(onDidChangeSelection)
          );
          disposables.push(quickPick);
          quickPick.show();

          const uri = await window.showOpenDialog({
            defaultUri: option.defaultUri ? Uri.file(option.defaultUri) : undefined,
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            title: option.title
          });
          const res = uri && uri.length > 0 ? uri[0].fsPath : undefined;
          if (res) {
            quickPick.items = [{label: option.prompt || "Select folder", detail: res}];
            resolve({ type: InputResultType.sucess, result: res });
          }
        }
      );
    } finally {
      disposables.forEach((d) => {
        d.dispose();
      });
    }
  }
}

export const VS_CODE_UI = new VsCodeUI();
  
