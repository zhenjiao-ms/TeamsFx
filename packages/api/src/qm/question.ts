// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
"use strict";

import { Inputs } from "../types";

/**
 * reference:
 * https://www.w3schools.com/html/html_form_input_types.asp
 * https://www.w3schools.com/tags/att_option_value.asp
 */
export enum NodeType {
    text = "text",
    number = "number",
    singleSelect = "singleSelect",
    multiSelect = "multiSelect",
    file = "file",
    group = "group",
    func = "func",
}

export type AnswerValue = string | string[] | number | OptionItem | OptionItem[] | undefined | unknown;

export interface FunctionRouter{
    namespace:string,
    method:string
}

export interface Func extends FunctionRouter{
    params?: unknown;
}

export type LocalFunc<T> = (inputs: Inputs) => T | Promise< T >;

export interface OptionItem {
    /**
     * the unique identifier of the option in the option list, not show
     */
    id: string;
    /**
     * A human-readable string which is rendered prominent.
     */
    label: string;
    /**
     * A human-readable string which is rendered less prominent in the same line.
     */
    description?: string;
    /**
     * A human-readable string which is rendered less prominent in a separate line.
     */
    detail?: string;
    /**
     * hidden data for this option item, not show
     */
    data?: unknown;
    /**
     * CLI diplay name, will use id instead if cliname not exist.
     */
    cliName?: string;
}



/**
 * static option can be string array or OptionItem array
 * if the option is a string array, each element of which will be converted to an `OptionItem` object with `id` and `label` field equal to the string element. 
 * For example, option=['id1','id2'] => [{'id':'id1', label:'id1'},{'id':'id2', label:'id2'}]
 */
export type StaticOption = string[] | OptionItem[];

/**
 * dynamic option is defined by a remote function call
 */
export type DymanicOption = LocalFunc<StaticOption|undefined>;


/**
 * select option can be static option list or dynamic options which are loaded from a function call
 */
export type Option = StaticOption | DymanicOption;

/**
 * Validation for Any Instance Type
 * JSON Schema Validation reference: http://json-schema.org/draft/2019-09/json-schema-validation.html
 */
export interface AnyValidation {
    required?: boolean; // default value is true
    equals?: unknown;
}

/**
 * Validation for Numeric Instances (number and integer)
 */
export interface NumberValidation extends AnyValidation {
    multipleOf?: number;
    maximum?: number;
    exclusiveMaximum?: number;
    minimum?: number;
    exclusiveMinimum?: number;
    /**
     * the value must be contained in the list
     */
    enum?: number[]; 
    equals?: number; //non-standard
}

/**
 * //Validation for Strings
 */
export interface StringValidation extends AnyValidation {
    maxLength?: number;
    minLength?: number;
    pattern?: string;
    enum?: string[]; // the value must be contained in this list
    startsWith?: string; //non-standard
    endsWith?: string; //non-standard
    includes?: string; //non-standard
    equals?: string; //non-standard
}

/**
 * Validation for String Arrays
 */
export interface StringArrayValidation extends AnyValidation {
    maxItems?: number;
    minItems?: number;
    uniqueItems?: boolean;
    equals?: string[]; //non-standard
    enum?: string[]; // non-standard all the values must be contained in this list
    contains?: string; ////non-standard
    containsAll?: string[]; ///non-standard, the values must contains all items in the array
    containsAny?: string[]; ///non-standard, the values must contains any one in the array
}

export interface FileValidation extends AnyValidation {
    /**
     * the file/folder must exist
     */
    exists?: boolean;
}

/**
 * The validation is checked by a validFunc provided by user
 */
export interface FuncValidation {
    validFunc?: (input: string|string[]|number, previousInputs: Inputs) => string | undefined | Promise<string | undefined>;
}

export type ValidationSchema =
    | NumberValidation
    | StringValidation
    | StringArrayValidation
    | FileValidation
    | FuncValidation;

/**
 * Basic question data
 */
export interface BaseQuestion {
    /**
     * question identifier
     */
    name: string;
    /**
     * question answer value
     */
    value?: AnswerValue;
}

export interface UserInputQuestion extends BaseQuestion{
    type: NodeType.singleSelect | NodeType.multiSelect | NodeType.file | NodeType.text | NodeType.number;
    title:string ;
    placeholder?: string | LocalFunc<string | undefined>;
    prompt?: string | LocalFunc<string | undefined>;
    default?: string | string[] | number | LocalFunc<string | string[] | number| undefined>;
    validation?: ValidationSchema;
}

export interface SingleSelectQuestion extends UserInputQuestion {
    
    type: NodeType.singleSelect;

    /**
     * select option
     */
    option: Option;

    /**
     * for single option select question, the answer value is the `id` string (`returnObject`:false) or `OptionItem` object (`returnObject`: true)
     */
    value?: string | OptionItem;

    /**
     * The default selected `id` value of the option item
     */
    default?: string | LocalFunc<string | undefined>;

    /**
     * works for string[] option
     */
    returnObject?: boolean;

    /**
     * whether to skip the single option select question
     * if true: single select question will be automtically answered with the single option;
     * if false: use still need to do the selection manually even there is no secon choice
     */
    skipSingleOption?:boolean;
}

export interface MultiSelectQuestion extends UserInputQuestion {
    type: NodeType.multiSelect;

    /**
     * select option
     */
    option: Option;
    
    /**
     * for multiple option select question, the answer value is the `id` string array (`returnObject`:false) or `OptionItem` object array (`returnObject`: true)
     */
    value?: string[] | OptionItem[];

    /**
     * The default selected `id` array of the option item
     */
    default?: string[] | LocalFunc<string[] | undefined>;

    /**
     * whether to return `OptionItem` or `OptionItem[]` if the items have type `OptionItem[]`
     * if the items has type `string[]`, this config will not take effect, the answer has type `string` or `string[]`
     */
    returnObject?: boolean;

    /**
     * whether to skip the single option select question
     * if true: single select question will be automtically answered with the single option;
     * if false: use still need to do the selection manually even there is no second choice
     */
    skipSingleOption?:boolean;

    /**
     * a callback function when the select changes
     */
    onDidChangeSelection?: (currentSelectedIds: Set<string>, previousSelectedIds: Set<string>) => Promise<Set<string>>;

    validation?: StringArrayValidation | FuncValidation;
}

export interface TextInputQuestion extends UserInputQuestion {
    type: NodeType.text;
    password?: boolean; 
    value?: string;
    default?: string | LocalFunc<string | undefined>;
    validation?: StringValidation | FuncValidation;
}

/**
 * `NumberInputQuestion` is similar to `TextInputQuestion`
 * The only difference is `NumberInputQuestion` will have an extra `is a valid number` validation check for the input string
 */
export interface NumberInputQuestion extends UserInputQuestion {
    type: NodeType.number;
    value?: number;
    default?: number | LocalFunc<number | undefined>;
    validation?: NumberValidation | FuncValidation;
}

export interface FileQuestion extends UserInputQuestion {
    type: NodeType.file;
    value?: string;
    default?: string | LocalFunc<string | undefined>;
    validation?: FileValidation | StringValidation | FuncValidation;
}


/**
 * `FuncQuestion` will not show any UI, but load some dynamic data in the question flow；
 * The dynamic data can be refered by the child question in condition check or default value.
 */
export interface FuncQuestion extends BaseQuestion{
    type: NodeType.func;
    title?: string;
    func: LocalFunc<AnswerValue>;
}

export interface Group {
    type: NodeType.group;
    name?: string; 
}

export type Question =
    | SingleSelectQuestion
    | MultiSelectQuestion
    | TextInputQuestion
    | NumberInputQuestion
    | FuncQuestion
    | FileQuestion;


/**
 * QTreeNode is the tree node data structure, which have three main properties:
 * - data: data is either a group or question. Questions can be organized into a group, which has the same trigger condition.
 * - condition: trigger condition for this node to be activated;
 * - children: child questions that will be activated according their trigger condition.
 */
export class QTreeNode {
    data: Question | Group;
    condition?: ValidationSchema;
    children?: QTreeNode[];
    addChild(node: QTreeNode): QTreeNode {
        if (!this.children) {
            this.children = [];
        }
        this.children.push(node);
        return this;
    }
    validate(): boolean {
        //1. validate the cycle depedency
        //2. validate the name uniqueness
        //3. validate the params of RPC
        // if (this.data.type === NodeType.group && (!this.children || this.children.length === 0)) return false;
        return true;
    }

    /**
     * trim the tree
     */
    trim():QTreeNode|undefined{
        if(this.children){
            const newChildren:QTreeNode[] = [];
            for(const node of this.children){
                const trimed = node.trim();
                if(trimed) 
                    newChildren.push(trimed);
            }
            this.children = newChildren;
        }
        if (this.data.type === NodeType.group) {
            if( !this.children || this.children.length === 0)
                return undefined;
            if( this.children.length === 1){
                this.children[0].condition = this.condition;
                return this.children[0];
            }
        }
        return this;
    }
    constructor(data: Question | Group) {
        this.data = data;
    }
}
