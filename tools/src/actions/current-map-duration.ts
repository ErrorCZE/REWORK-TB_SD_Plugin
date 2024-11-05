import {
    streamDeck,
    action,
    SingletonAction,
    WillAppearEvent
} from "@elgato/streamdeck";

@action({ UUID: "eu.tarkovbot.tools.mapinfo.raidduration" })
export class TarkovCurrentMapInfo_Duration extends SingletonAction {

    override onWillAppear(ev: WillAppearEvent): void | Promise<void> {
        const locationId = globalThis.location;
        if (locationId) {
            const mapData = globalThis.locationsDataPVE?.find(map => map.nameId === locationId);
            if (mapData) {
                ev.action.setTitle(`\n${mapData.raidDuration} min`);
            } else {
                ev.action.setTitle("No Map\nData");
            }
        } else {
            ev.action.setTitle("\nUnknown\nLocation");
        }
    }
}