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

            
        } 
    } catch (error) {
        streamDeck.logger.error("Error loading settings:", error);
    }
}

// Load settings on startup
loadSettings();

@action({ UUID: "eu.tarkovbot.tools.mapinfo.playercount" })
export class TarkovCurrentMapInfo_Players extends SingletonAction {
    override async onWillAppear(ev: WillAppearEvent): Promise<void> {

        this.updatePlayerCount(ev);

        if (intervalUpdateInterval) {
            clearInterval(intervalUpdateInterval);
            intervalUpdateInterval = null;
        }

        if (map_autoupdate_check) {
            intervalUpdateInterval = setInterval(() => this.updatePlayerCount(ev), 5000);
        }
    }

    override onWillDisappear(ev: WillDisappearEvent): void {
        if (intervalUpdateInterval) {
            clearInterval(intervalUpdateInterval);
            intervalUpdateInterval = null;
        }
    }

    private updatePlayerCount(ev: WillAppearEvent): void {
        const locationId = globalThis.location;
        ev.action.setTitle("");

        if (locationId) {
            // Use PvE data if pve_map_mode_check is true; otherwise, use PvP data
            const mapData = pve_map_mode_check
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
