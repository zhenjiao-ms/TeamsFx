import { Context,ResourceTemplates, SolutionContext, SolutionPlugin, TokenProvider, ResourceInstanceValues, StateValues} from "fx-api";


export interface CoreContext extends Context{

    globalSolutions: Map<string, SolutionPlugin>;

    solution?:SolutionPlugin;

    provisionTemplates?:ResourceTemplates;

    deployTemplates?: ResourceTemplates;

    resourceInstanceValues?: ResourceInstanceValues;

    stateValues?: StateValues;

    tokenProvider: TokenProvider;

    solutionContext?: SolutionContext;
}