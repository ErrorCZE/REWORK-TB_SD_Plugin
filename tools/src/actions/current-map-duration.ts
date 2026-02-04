import {
    streamDeck,
    action,
    SingletonAction,
    WillAppearEvent,
    WillDisappearEvent
} from "@elgato/streamdeck";
import { loadSettings } from "../utils/settings";
import { getMapData } from "../utils/map-data";

let intervalUpdateInterval: NodeJS.Timeout | null = null;

@action({ UUID: "eu.tarkovbot.tools.mapinfo.raidduration" })
export class TarkovCurrentMapInfo_Duration extends SingletonAction {
    override async onWillAppear(ev: WillAppearEvent): Promise<void> {
        this.updateRaidDuration(ev);

        if (intervalUpdateInterval) {
            clearInterval(intervalUpdateInterval);
            intervalUpdateInterval = null;
        }

        const settings = loadSettings();
        if (settings.map_autoupdate_check) {
            intervalUpdateInterval = setInterval(() => this.updateRaidDuration(ev), 5000);
        }
    }

    override onWillDisappear(ev: WillDisappearEvent): void {
        if (intervalUpdateInterval) {
            clearInterval(intervalUpdateInterval);
            intervalUpdateInterval = null;
        }
    }

    private updateRaidDuration(ev: WillAppearEvent): void {
        const settings = loadSettings();
        const locationId = globalThis.location;
        ev.action.setTitle("");

        if (locationId) {
            const mapData = getMapData(locationId, settings.pve_map_mode_check);

            if (mapData) {
                ev.action.setTitle(`\n${mapData.raidDuration} min`);
            } else {
                ev.action.setTitle("\nNo Map\nData");
            }
        } else {
            ev.action.setTitle("\nUnknown\nLocation");
        }
    }
}