import {
    streamDeck,
    action,
    SingletonAction,
    WillAppearEvent
} from "@elgato/streamdeck";

@action({ UUID: "eu.tarkovbot.tools.mapinfo.playercount" })
export class TarkovCurrentMapInfo_Players extends SingletonAction {

    override onWillAppear(ev: WillAppearEvent): void | Promise<void> {
        const pveMode = globalThis.pve_map_mode_check;
        const locationId = globalThis.location;

        if (locationId) {
            // Use PvE data if pveMode is true; otherwise, use PvP data
            const mapData = pveMode
                ? globalThis.locationsDataPVE?.find(map => map.nameId === locationId)
                : globalThis.locationsDataPVP?.find(map => map.nameId === locationId);

            if (mapData) {
                ev.action.setTitle(`\n${mapData.players}`);
            } else {
                ev.action.setTitle("\nNo Map\nData");
            }
        } else {
            ev.action.setTitle("\nUnknown\nLocation");
        }
    }
}

