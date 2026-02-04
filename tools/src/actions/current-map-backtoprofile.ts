import {
    streamDeck,
    action,
    SingletonAction,
    WillAppearEvent,
    KeyDownEvent
} from "@elgato/streamdeck";

@action({ UUID: "eu.tarkovbot.tools.mapinfo.mainprofile" })
export class TarkovCurrentMapInfo_BackToProfile extends SingletonAction {

    override onWillAppear(ev: WillAppearEvent): void | Promise<void> {
        ev.action.setTitle("Back");
    }

    override async onKeyDown(ev: KeyDownEvent): Promise<void> {

        streamDeck.profiles.switchToProfile(ev.action.device.id, undefined);
    }
}
