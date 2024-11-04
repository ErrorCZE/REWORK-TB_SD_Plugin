import {
    streamDeck,
    action,
    SingletonAction,
    WillAppearEvent
} from "@elgato/streamdeck";

@action({ UUID: "eu.tarkovbot.tools.mapinfo.name" })
export class TarkovCurrentMapInfo_Name extends SingletonAction {

    override onWillAppear(ev: WillAppearEvent): void | Promise<void> {
        const locationId = globalThis.location;
        if (locationId) {
            const mapData = globalThis.locationsDataPVE?.find(map => map.nameId === locationId);
            if (mapData) {
                ev.action.setTitle(mapData.name);
            } else {
                ev.action.setTitle("No\nMap\nData");
            }
        } else {
            ev.action.setTitle("Unknown\nLocation");
        }
    }
}
