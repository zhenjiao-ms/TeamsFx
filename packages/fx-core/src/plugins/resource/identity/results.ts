import { SystemError, UserError, Result as FxResult, FxError } from "@microsoft/teamsfx-api";
import { Constants } from "./constants";

export type Result = FxResult<any, FxError>;

export class ResultFactory {
    static readonly source: string = Constants.pluginNameShort;
    static readonly defaultHelpLink = "";
    static readonly defaultIssueLink = "";

    public static UserError(name: string, message: string, innerError?: any, stack?: string, helpLink?: string): UserError {
        return new UserError(name, message, this.source, stack, helpLink, innerError);
    }

    public static SystemError(name: string, message: string, innerError?: any, stack?: string, issueLink?: string): SystemError {
        return new SystemError(name, message, this.source, stack, issueLink, innerError);
    }
}