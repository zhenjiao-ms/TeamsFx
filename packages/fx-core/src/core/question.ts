// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
import { FileQuestion, Inputs, NodeType, SingleSelectQuestion, StaticOption, TextInputQuestion } from "fx-api";
import * as jsonschema from "jsonschema";
import * as path from "path";
import * as fs from "fs-extra";

export enum CoreQuestionNames {
    AppName = "app-name",
    Foler = "folder",
    Solution = "solution",
    Stage = "stage",
    SubStage = "substage",
    EnvName = "env-name",
    EnvLocal = "env-local",
    EnvSideLoading = "env-sideloading"
}

export const QuestionAppName: TextInputQuestion = {
    type: NodeType.text,
    name: CoreQuestionNames.AppName,
    title: "App Name",
    validation: {
        validFunc : async (input: string|string[]|number, answer: Inputs) : Promise<string | undefined> => {
            const folder = answer[CoreQuestionNames.Foler] as string;
            if(!folder) return undefined;
            const schema = {
                pattern: "^[\\da-zA-Z]+$",
            };
            const validateResult = jsonschema.validate(input as string, schema);
            if (validateResult.errors && validateResult.errors.length > 0) {
                return `project name doesn't match pattern: ${schema.pattern}`;
            }
            const projectPath = path.resolve(folder, input as string);
            const exists = await fs.pathExists(projectPath);
            if (exists) return `Project path already exists:${projectPath}, please change a different project name.`;
            return undefined;
        }
    },
    default: "myapp",
};

export const QuestionRootFolder: FileQuestion = {
    type: NodeType.file,
    name: CoreQuestionNames.Foler,
    title: "Select root folder of the project"
};

export const QuestionSelectSolution: SingleSelectQuestion = {
    type: NodeType.singleSelect,
    name: CoreQuestionNames.Solution,
    title: "Select a solution",
    option: [],
    skipSingleOption:true
};


export const QuestionEnvName: TextInputQuestion = {
    type: NodeType.text,
    name: CoreQuestionNames.EnvName,
    title: "Environment Name",
    default: "myenv",
};

export const QuestionEnvLocal: SingleSelectQuestion = {
    type: NodeType.singleSelect,
    name: CoreQuestionNames.EnvLocal,
    title: "Environment Is Local?",
    option: ["true", "false"]
};

export const QuestionEnvSideLoading: SingleSelectQuestion = {
    type: NodeType.singleSelect,
    name: CoreQuestionNames.EnvSideLoading,
    title: "Environment sideloading?",
    option: ["true", "false"]
};

export const QuestionSelectEnv: SingleSelectQuestion = {
    type: NodeType.singleSelect,
    name: CoreQuestionNames.EnvName,
    title: "Select an environment",
    option: async (inputs: Inputs) : Promise<StaticOption|undefined> =>{
        return undefined;
    }
};