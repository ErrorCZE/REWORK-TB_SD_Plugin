import {
    streamDeck,
    action,
    SingletonAction,
    WillAppearEvent,
    WillDisappearEvent,
    DidReceiveSettingsEvent
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

            streamDeck.logger.info("Settings loaded from user_settings.json:", settings);
        } else {
            streamDeck.logger.info("user_settings.json not found, using defaults.");
        }
    } catch (error) {
        streamDeck.logger.error("Error loading settings:", error);
    }
}

// Load settings on startup
loadSettings();

@action({ UUID: "eu.tarkovbot.tools.mapinfo.name" })
export class TarkovCurrentMapInfo_Name extends SingletonAction {
    override async onWillAppear(ev: WillAppearEvent): Promise<void> {
        streamDeck.logger.info("onWillAppear triggered for Map Name.");

        this.updateMapName(ev);

        if (intervalUpdateInterval) {
            clearInterval(intervalUpdateInterval);
            intervalUpdateInterval = null;
        }

        if (map_autoupdate_check) {
            intervalUpdateInterval = setInterval(() => this.updateMapName(ev), 5000);
            streamDeck.logger.info("Auto-update enabled (every 5 sec).");
        } else {
            streamDeck.logger.info("Auto-update is disabled.");
        }
    }


    override onWillDisappear(ev: WillDisappearEvent): void {
        if (intervalUpdateInterval) {
            clearInterval(intervalUpdateInterval);
            intervalUpdateInterval = null;
            streamDeck.logger.info("Auto-update stopped (onWillDisappear).");
        }
    }

    private updateMapName(ev: WillAppearEvent): void {
        const locationId = globalThis.location;
        ev.action.setTitle("");

        if (locationId) {
            // Use PvE data if pve_map_mode_check is true; otherwise, use PvP data
            const mapData = pve_map_mode_check
                ? globalThis.locationsDataPVE?.find(map => map.nameId === locationId)
                : globalThis.locationsDataPVP?.find(map => map.nameId === locationId);

            if (mapData) {
                ev.action.setTitle(`\n${mapData.name}`);
            } else {
                ev.action.setTitle("\nNo Map\nData");
            }
        } else {
            ev.action.setTitle("\nUnknown\nLocation");
        }
    }
}
