// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import {
  TextInputQuestion,
  NodeType,
  QTreeNode,
  Question,
  SingleSelectQuestion,
  Option,
  StaticOption,
  OptionItem,
  MultiSelectQuestion,
  FileQuestion,
  NumberInputQuestion,
  FuncQuestion
} from "./question";
import { getValidationFunction, validate } from "./validation";
import { returnSystemError, returnUserError } from "../error";
import { Inputs } from "../types";
import { InputResult, InputResultType, UserInterface } from "../ui";

export function isAutoSkipSelect(q: Question): boolean {
  if (q.type === NodeType.singleSelect || q.type === NodeType.multiSelect) {
    const select = q as (SingleSelectQuestion | MultiSelectQuestion);
    const options = select.option as StaticOption;
    if (select.skipSingleOption && select.option instanceof Array && options.length === 1) {
      return true;
    }
  }
  return false;
}

export async function loadOptions(q: Question, inputs: Inputs): Promise<{autoSkip:boolean, options?: StaticOption}> {
  if (q.type === NodeType.singleSelect || q.type === NodeType.multiSelect) {
    const selectQuestion = q as (SingleSelectQuestion | MultiSelectQuestion);
    let option: Option = [];
    if (selectQuestion.option instanceof Array) {
      //StaticOption
      option = selectQuestion.option;
    } else {
      option = await getCallFuncValue(inputs, selectQuestion.option) as StaticOption;
    }
    if (selectQuestion.skipSingleOption && option.length === 1) {
      return {autoSkip:true, options: option};
    }
    else {
      return {autoSkip:false, options: option};
    }
  }
  else {
    return {autoSkip:false};
  }
}

export function getSingleOption(q: SingleSelectQuestion | MultiSelectQuestion, option?: StaticOption) : any{
  if(!option) option = q.option as StaticOption;
  const optionIsString = typeof option[0] === "string";
  let returnResult;
  if (!optionIsString && q.returnObject === true) {
    returnResult = option[0];
  }
  else {
    returnResult = optionIsString ? option[0] : (option[0] as OptionItem).id;
  }
  if (q.type === NodeType.singleSelect) {
    return returnResult;
  }
  else {
    return [returnResult];
  }
}

type QuestionVistor = (
  question: Question,
  ui: UserInterface,
  inputs: Inputs ,
  step?: number,
  totalSteps?: number,
) => Promise<InputResult>;
 

async function getCallFuncValue(inputs: Inputs , raw?: unknown ):Promise<unknown>{
  if(raw && typeof raw === "function") {
    return await raw(inputs);
  }
  return raw;
}

/**
 * ask question when visiting the question tree
 * @param question
 * @param core
 * @param inputs
 */
const questionVisitor: QuestionVistor = async function (
  question: Question,
  ui: UserInterface,
  inputs: Inputs ,
  step?: number,
  totalSteps?: number,
): Promise<InputResult> {  
  if (question.type === NodeType.func) {
     const funcQuestion = question as FuncQuestion;
     return await ui.showFuncQuestion({
      title: funcQuestion.title || funcQuestion.name,
      step: step,
      totalSteps: totalSteps,
      func: funcQuestion
     });
  } else {
    const defaultValue = question.value? question.value : await getCallFuncValue(inputs, question.default);
    if (question.type === NodeType.text || question.type === NodeType.number) {
      const inputQuestion: TextInputQuestion | NumberInputQuestion = question as (TextInputQuestion | NumberInputQuestion);
      const validationFunc = inputQuestion.validation ? getValidationFunction(inputQuestion.validation, inputs) : undefined;
      const placeholder = await getCallFuncValue(inputs, inputQuestion.placeholder) as string;
      const prompt = await getCallFuncValue(inputs, inputQuestion.prompt) as string;
      return await ui.showInputBox({
        title: question.title,
        password: (inputQuestion as TextInputQuestion).password,
        defaultValue: defaultValue as string,
        placeholder: placeholder,
        prompt: prompt,
        validation: validationFunc,
        number: !!(question.type === NodeType.number),
        step: step,
        totalSteps: totalSteps
      });
    } else if (question.type === NodeType.singleSelect || question.type === NodeType.multiSelect) {
      const selectQuestion: SingleSelectQuestion | MultiSelectQuestion = question as | SingleSelectQuestion | MultiSelectQuestion;
      const res = await loadOptions(selectQuestion, inputs);
      if (!res.options || res.options.length === 0) {
        return {
          type: InputResultType.error,
          error: returnSystemError(
            new Error("Select option is empty!"),
            "API",
            "EmptySelectOption"
          )
        };
      }
      // Skip single/mulitple option select
      if (res.autoSkip === true) {
        const returnResult = getSingleOption(selectQuestion, res.options);
        return {
          type: InputResultType.pass,
          result: returnResult
        };
      }
      const placeholder = await getCallFuncValue(inputs, selectQuestion.placeholder) as string;
      const mq = (selectQuestion as MultiSelectQuestion);
      const validationFunc = mq.validation ? getValidationFunction( mq.validation, inputs) : undefined;
      return await ui.showQuickPick({
        title: question.title,
        items: res.options,
        canSelectMany: !!(question.type === NodeType.multiSelect),
        returnObject: selectQuestion.returnObject,
        defaultValue: defaultValue as (string | string[]),
        placeholder: placeholder,
        onDidChangeSelection: question.type === NodeType.multiSelect ? (selectQuestion as MultiSelectQuestion).onDidChangeSelection : undefined,
        step: step,
        totalSteps: totalSteps,
        validation: validationFunc
      });
    } else if (question.type === NodeType.file) {
      const fileQuestion: FileQuestion = question as FileQuestion;
      const validationFunc = fileQuestion.validation ? getValidationFunction(fileQuestion.validation, inputs) : undefined;
      return await ui.showFileOpenDialog({
        defaultUri: defaultValue as string,
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        title: question.title,
        validation: validationFunc,
        step: step,
        totalSteps: totalSteps
      });
    }
  }
  return {
    type: InputResultType.error,
    error: returnUserError(
      new Error(`Unsupported question node type:${JSON.stringify(question)}`),
      "API.qm",
      "UnsupportedNodeType"
    )
  };
};

export async function traverse(
  root: QTreeNode,
  inputs: Inputs ,
  ui: UserInterface
): Promise<InputResult> {
  const stack: QTreeNode[] = [];
  const history: QTreeNode[] = [];
  let firstQuestion: Question | undefined;
  stack.push(root);
  let step = 0;
  let totalSteps = 1;
  const parentMap = new Map<QTreeNode, QTreeNode>();
  while (stack.length > 0) {
    const curr = stack.pop();
    if(!curr) continue;
    const parent = parentMap.get(curr);
    let parentValue = parent && parent.data.type !== NodeType.group ? parent.data.value : undefined;
    if (curr.condition) {
      /// if parent node is single select node and return OptionItem as value, then the parentValue is it's id
      if (parent && parent.data.type === NodeType.singleSelect) {
        const sq:SingleSelectQuestion = parent.data;
        if (sq.returnObject) {
          parentValue = (sq.value as OptionItem).id;
        }
      } 
      if (parentValue) {
        const validRes = await validate(curr.condition, parentValue as string | string[] | number, inputs);
        if (validRes !== undefined) {
          continue;
        }
      }
    }

    //visit
    if (curr.data.type !== NodeType.group) {
      const question = curr.data as Question;
      if (!firstQuestion) firstQuestion = question;
      ++ step;
      totalSteps = step + stack.length;
      const inputResult = await questionVisitor(question, ui, inputs, step, totalSteps);
      if (inputResult.type === InputResultType.back) {
        //go back
        if (curr.children) {
          while (stack.length > 0) {
            const tmp = stack[stack.length - 1];
            if (curr.children.includes(tmp)) {
              stack.pop();
            } else {
              break;
            }
          }
        }
        stack.push(curr);
        -- step;
        // find the previoud input that is neither group nor func nor single option select
        let found = false;
        while (history.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          const last = history.pop()!;
          if (last.children) {
            while (stack.length > 0) {
              const tmp = stack[stack.length - 1];
              if (last.children.includes(tmp)) {
                stack.pop();
              } else {
                break;
              }
            }
          }
          stack.push(last);
          -- step;
          let autoSkip = false;
          if(last.data.type === NodeType.singleSelect || last.data.type === NodeType.multiSelect){
            const loadOptionRes = await loadOptions(last.data, inputs);
            autoSkip = loadOptionRes.autoSkip;
          }
          
          if (
            last.data.type !== NodeType.group &&
            last.data.type !== NodeType.func &&
            !autoSkip
          ) {
            found = true;
            break;
          }
        }
        if (!found) {
          // no node to back
          return { type: InputResultType.back };
        }
        continue; //ignore the following steps
      } else if (
        inputResult.type === InputResultType.error ||
        inputResult.type === InputResultType.cancel
      ) {
        //cancel
        return inputResult;
      } //continue
      else {
        //success or pass
        question.value = inputResult.result;
        inputs[question.name] = question.value;
      }
    }

    history.push(curr);

    if (curr.children) {
      for (let i = curr.children.length - 1; i >= 0; --i) {
        const child = curr.children[i];
        if (!child) continue;
        parentMap.set(child, curr);
        stack.push(child);
      }
    }
  }
  return { type: InputResultType.sucess };
}

