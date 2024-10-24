import { action, KeyDownEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";

const apiURL = "https://tarkovbot.eu/api/streamdeck/goonslocation";

@action({ UUID: "eu.tarkovbot.tools.traderrestock" })
export class TarkovTraderRestock extends SingletonAction {

    override onWillAppear(ev: WillAppearEvent): void | Promise<void> {
        ev.action.setTitle(`Loading`);
    };
}

