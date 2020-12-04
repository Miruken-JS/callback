import { Handler } from "../../handler";
import { handles, $unhandled } from "../../callback-policy";
import { unmanaged } from "../../unmanaged";
import { skipFilters } from "../../filter/filter";
import { Routed } from "../route/routed";
import "../handler-api";

@unmanaged
export class PassThroughRouter extends Handler {
    @skipFilters
    @handles(Routed)
    route(routed, { composer }) {
        return routed.route === PassThroughRouter.scheme
             ? composer.send(routed.message)
             : $unhandled;
    }

    static get scheme() { return "pass-through"; }
}