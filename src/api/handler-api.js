import { $isNothing } from "miruken-core";
import { Handler } from "../handler";
import { Command } from "../command";
import { Stash } from "../api/stash";
import { NotHandledError } from "../errors";

Handler.implement({
    send(request) {
        if ($isNothing(request)) return;
        const command = new Command(request);
        if (!(new Stash().$chain(this)).handle(command, false)) {
            throw new NotHandledError(request);
        }
        return command.callbackResult;
    },
    publish(notification) {
        if ($isNothing(notification)) return;
        const command = new Command(notification, true);
        if (!(new Stash().$chain(this)).handle(command, true)) {
            throw new NotHandledError(notification);
        }
        return command.callbackResult;
    }    
});
