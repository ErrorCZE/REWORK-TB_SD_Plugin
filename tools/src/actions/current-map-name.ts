import {
    streamDeck,
    action,
    SingletonAction,
    WillAppearEvent,
    WillDisappearEvent
} from "@elgato/streamdeck";
import fs from "fs";
import path from "path";

const settingsFilePath = path.join(process.cwd(), "user_settings.json");

let map_autoupdate_check = false;
let pve_map_mode_check = false;
let intervalUpdateInterval: NodeJS.Timeout | null = null;

// Load settings from user_settings.json
function loadSettings(): void {
    try {
        if (fs.existsSync(settingsFilePath)) {
            const fileData = fs.readFileSync(settingsFilePath, "utf8");
            const settings = JSON.parse(fileData);

            map_autoupdate_check = settings.current_map_info?.map_autoupdate_check || false;
            pve_map_mode_check = settings.current_map_info?.pve_map_mode_check || false;

            streamDeck.logger.info(`Loaded settings - Auto Update: ${map_autoupdate_check}, PvE Mode: ${pve_map_mode_check}`);
        } 
    } catch (error) {
        streamDeck.logger.info(`Error loading settings: ${error}`);
    }
}

// Load settings on startup
loadSettings();

@action({ UUID: "eu.tarkovbot.tools.mapinfo.name" })
export class TarkovCurrentMapInfo_Name extends SingletonAction {
    override async onWillAppear(ev: WillAppearEvent): Promise<void> {
        streamDeck.logger.info("Action will appear");

        this.updateMapName(ev);

        if (intervalUpdateInterval) {
            clearInterval(intervalUpdateInterval);
            intervalUpdateInterval = null;
        }

        if (map_autoupdate_check) {
            streamDeck.logger.info("Starting auto-update interval");
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
        const locationId = globalThis.location;
        streamDeck.logger.info(`Current Location ID: ${locationId}`);

        ev.action.setTitle("");

        if (locationId) {
            // Use PvE data if pve_map_mode_check is true; otherwise, use PvP data
            const mapData = pve_map_mode_check
                ? globalThis.locationsDataPVE?.find(map => map.nameId === locationId)
                : globalThis.locationsDataPVP?.find(map => map.nameId === locationId);

            streamDeck.logger.info(`Map Mode: ${pve_map_mode_check ? 'PvE' : 'PvP'}`);
            streamDeck.logger.info(`Found Map Data: ${mapData ? JSON.stringify(mapData) : 'No map data'}`);

            if (mapData) {
                ev.action.setTitle(`\n${mapData.name.replace(/ /g, "\n")}`);
            } else {
                ev.action.setTitle("\nNo Map\nData");
            }
        } else {
            ev.action.setTitle("\nUnknown\nLocation");
        }
    }
}