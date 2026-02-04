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

@action({ UUID: "eu.tarkovbot.tools.mapinfo.name" })
export class TarkovCurrentMapInfo_Name extends SingletonAction {
    override async onWillAppear(ev: WillAppearEvent): Promise<void> {
        streamDeck.logger.info("Action will appear");

        this.updateMapName(ev);

        if (intervalUpdateInterval) {
            clearInterval(intervalUpdateInterval);
            intervalUpdateInterval = null;
        }

        const settings = loadSettings();
        if (settings.map_autoupdate_check) {
            streamDeck.logger.info("Starting auto-update interval for map name");
            intervalUpdateInterval = setInterval(() => this.updateMapName(ev), 5000);
        }
    }

    override onWillDisappear(ev: WillDisappearEvent): void {
        streamDeck.logger.info("Action will disappear");
        if (intervalUpdateInterval) {
            clearInterval(intervalUpdateInterval);
            intervalUpdateInterval = null;
        }
    }

    private updateMapName(ev: WillAppearEvent): void {
        const settings = loadSettings();
        streamDeck.logger.info("updateMapName called");

        const locationId = globalThis.location;
        streamDeck.logger.info(`Current Location ID: ${locationId}`);

        ev.action.setTitle("");

        if (locationId) {
            streamDeck.logger.info("Fetching map data...");

            const mapData = getMapData(locationId, settings.pve_map_mode_check);

            streamDeck.logger.info(`Map Mode: ${settings.pve_map_mode_check ? 'PvE' : 'PvP'}`);
            streamDeck.logger.info(`Found Map Data: ${mapData ? JSON.stringify(mapData) : 'No map data'}`);

            if (mapData) {
                const formattedName = `\n${mapData.name.replace(/ /g, "\n")}`;
                streamDeck.logger.info(`Setting title: ${formattedName}`);
                ev.action.setTitle(formattedName);
            } else {
                streamDeck.logger.info("No map data found, setting default title");
                ev.action.setTitle("\nNo Map\nData");
            }
        } else {
            streamDeck.logger.info("Unknown location, setting default title");
            ev.action.setTitle("\nUnknown\nLocation");
        }
    }

}