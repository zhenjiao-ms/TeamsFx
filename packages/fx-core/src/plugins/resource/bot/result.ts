/**
 * This file is used to wrap result type of fx-api for function plugin because of its instability.
 */

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
import { FxError, Result, SystemError, UserError, err, ok } from "@microsoft/teamsfx-api";

import { Links, Alias } from "./constants";

export type FxResult = Result<any, FxError>;

export class FxBotPluginResultFactory {
    static readonly source: string = Alias.TEAMS_BOT_PLUGIN;
    static readonly defaultHelpLink: string = Links.HELP_LINK;
    static readonly defaultIssueLink: string = Links.ISSUE_LINK;

    public static UserError(errorName: string, errorMessage: string, showHelpLink: boolean, innerError?: any): FxResult {
        return err(new UserError(
            errorName,
            errorMessage,
            FxBotPluginResultFactory.source,
            innerError?.stack,
            showHelpLink ? FxBotPluginResultFactory.defaultHelpLink : undefined,
            innerError
        ));
    }

    public static SystemError(errorName: string, errorMessage: string, innerError?: any): FxResult {
        return err(new SystemError(
            errorName,
            errorMessage,
            FxBotPluginResultFactory.source,
            innerError?.stack,
            FxBotPluginResultFactory.defaultIssueLink,
            innerError
        ));
    }

    public static Success(result?: any): FxResult {
        return ok(result);
    }
}