import {
    streamDeck,
    action,
    SingletonAction,
    WillAppearEvent,
    KeyDownEvent,
    DidReceiveSettingsEvent,
    SendToPluginEvent,
} from "@elgato/streamdeck";
import fs from "fs";
import path from "path";
import { loadSettings, saveSettings, SETTINGS_FILE_PATH } from "../utils/settings";
import { extractTimestamp, getLatestLogFile } from "../utils/log-parser";
import { detectEftPath } from "../utils/eft-path";

interface BossHealth {
    bodyPart: string;
    max: number;
}

interface Boss {
    spawnChance: number;
    boss: any;
    id: string;
    name: string;
    health: BossHealth[];

}

interface MapData {
    id: string;
    name: string;
    nameId: string;
    accessKeysMinPlayerLevel: number;
    raidDuration: number;
    players: string;
    accessKeys: any[];
    bosses: Boss[];
}

interface LocalMapEntry {
    localIDs: string[];
    dataID: string;
}

interface ApiResponse {
    maps: MapData[];
}

const apiURLs = {
    PVE: "https://tarkovbot.eu/api/pve/streamdeck/maps",
    PVP: "https://tarkovbot.eu/api/streamdeck/maps",
    LOCAL_MAP_NAMES: "https://tarkovbot.eu/api/pve/streamdeck/local-map-names"
};

async function refreshData(mode: 'PVE' | 'PVP'): Promise<void> {
    const apiURL = apiURLs[mode];
    try {
        const response = await fetch(apiURL);
        const jsonData = await response.json();

        if (isApiResponse(jsonData)) {
            const locationsData = jsonData.maps.map(map => {
                const bossMap = new Map<string, { id: string; spawnChances: number[] }>();

                map.bosses.forEach(bossData => {
                    const bossName = bossData.boss.name;
                    const bossId = bossData.boss.id;
                    const spawnChance = (bossData.spawnChance * 100).toFixed(0);

                    if (!bossMap.has(bossName)) {
                        bossMap.set(bossName, { id: bossId, spawnChances: [] });
                    }
                    bossMap.get(bossName)!.spawnChances.push(Number(spawnChance));
                });

                const consolidatedBosses = Array.from(bossMap).map(([name, { id, spawnChances }]) => {
                    const lowest = Math.min(...spawnChances);
                    const highest = Math.max(...spawnChances);
                    const spawnChanceString = lowest === highest ? `${lowest}%` : `${lowest}-${highest}%`;
                    return { name, spawnChance: spawnChanceString, id };
                });

                return {
                    ...map,
                    bosses: consolidatedBosses
                };
            });

            globalThis[`locationsData${mode}`] = locationsData;
            streamDeck.logger.info(`Processed ${mode} Map Data`);
        }
    } catch (error) {
        streamDeck.logger.error(`Error fetching ${mode} data:`, error);
    }
}

function isApiResponse(data: any): data is ApiResponse {
    return data && typeof data === 'object' && Array.isArray(data.maps);
}

let localMapNames: LocalMapEntry[] = [];

// Refresh local map names
async function refreshLocalMapNames(): Promise<void> {
    try {
        const response = await fetch(apiURLs.LOCAL_MAP_NAMES);
        const jsonData = await response.json();

        if (isLocalMapNamesArray(jsonData)) {
            localMapNames = jsonData;
            streamDeck.logger.info("Local map names loaded successfully");
        }
    } catch (error) {
        streamDeck.logger.error("Error fetching local map names:", error);
    }
}

function isLocalMapNamesArray(data: any): data is LocalMapEntry[] {
    return Array.isArray(data) && data.every(item =>
        item && typeof item === 'object' &&
        Array.isArray(item.localIDs) &&
        typeof item.dataID === 'string'
    );
}

refreshLocalMapNames();

refreshData('PVE');
refreshData('PVP');


setInterval(() => refreshData('PVE'), 1200000);
setInterval(() => refreshData('PVP'), 1200000);


let intervalUpdateInterval: any;

@action({ UUID: "eu.tarkovbot.tools.mapinfo" })
export class TarkovCurrentMapInfo extends SingletonAction {

    override async onWillAppear(ev: WillAppearEvent): Promise<void> {
        ev.action.setTitle(`Get\nCurrent\nMap Info`);
    }

    override async onKeyDown(ev: KeyDownEvent): Promise<void> {
        const eftInstallPath = ev.payload.settings.eft_install_path;
        streamDeck.logger.info("Payload settings on keydown: " + JSON.stringify(ev.payload.settings));

        if (intervalUpdateInterval) {
            clearInterval(intervalUpdateInterval);
            intervalUpdateInterval = null;
        }

        globalThis.location = await this.getLatestMap(eftInstallPath);

        if (ev.payload.settings.map_autoupdate_check) {
            intervalUpdateInterval = setInterval(async () => {
                globalThis.location = await this.getLatestMap(eftInstallPath);
                streamDeck.logger.info("Auto-update interval triggered; location:", globalThis.location);
            }, 3000);
        } else {
            streamDeck.logger.info("Auto-update disabled; location:", globalThis.location);
        }

        if (globalThis.location) {
            streamDeck.profiles.switchToProfile(ev.action.device.id, await this.getProfilePath(ev.action.device.type));
        } else {
            ev.action.setTitle("Not Found");
            streamDeck.logger.info("Map not found; returned value:", globalThis.location);
        }
    }

    private async getLatestMap(eftPath: any): Promise<string | null> {
        try {
            const settings = loadSettings();
            const pveMode = settings.pve_map_mode_check;

            const logsPath = `${eftPath}\\Logs`;
            streamDeck.logger.info("Using logs path:", logsPath);

            const folders = await fs.promises.readdir(logsPath, { withFileTypes: true });
            const logFolders = folders
                .filter(f => f.isDirectory() && f.name.startsWith("log_"))
                .map(f => ({
                    dirent: f,
                    timestamp: extractTimestamp(f.name)
                }))
                .sort((a, b) => b.timestamp - a.timestamp)
                .map(f => f.dirent);

            if (logFolders.length === 0) {
                streamDeck.logger.info("No log folders found");
                return null;
            }

            const latestFolder = `${logsPath}\\${logFolders[0].name}`;
            streamDeck.logger.info("Checking latest log folder:", latestFolder);

            const files = await fs.promises.readdir(latestFolder, { withFileTypes: true });
            const logFiles = files
                .filter(f => f.isFile() && f.name.includes("application") && f.name.endsWith(".log"))
                .sort((a, b) => b.name.localeCompare(a.name));

            if (logFiles.length === 0) {
                streamDeck.logger.info("No log files found in folder:", latestFolder);
                return null;
            }

            const latestFile = `${latestFolder}\\${logFiles[0].name}`;
            streamDeck.logger.info("Reading latest log file:", latestFile);

            const content = await fs.promises.readFile(latestFile, "utf-8");
            const lines = content.split("\n");

            // Check based on pve_map_mode_check setting
            if (pveMode) {
                // Using scene preset path method for PVE mode
                let latestMapName = null;

                for (let i = lines.length - 1; i >= 0; i--) {
                    const sceneMatch = lines[i].match(/rcid:([\w_]+)\.ScenesPreset\.asset/i);
                    if (sceneMatch) {
                        const mapName = sceneMatch[1].toLowerCase();
                        streamDeck.logger.info("Map name from scene:", mapName);
                        latestMapName = mapName;

                        // Only process the last map found - exit after first match when reading backward
                        break;
                    }
                }

                if (latestMapName) {
                    // Check if map name exists in localMapNames
                    if (localMapNames) {
                        for (const mapEntry of localMapNames) {
                            const localIDsLowercase = mapEntry.localIDs.map(id => id.toLowerCase());
                            if (localIDsLowercase.includes(latestMapName)) {
                                streamDeck.logger.info("Map location found (PVE mode):", mapEntry.dataID);
                                return mapEntry.dataID;
                            }
                        }
                        streamDeck.logger.info("No matching dataID found for map:", latestMapName);
                    }
                    // If we couldn't map it, just return the map name we found
                    return latestMapName;
                }
            } else {
                // Using original Location method
                for (let i = lines.length - 1; i >= 0; i--) {
                    const match = lines[i].match(/Location:\s(\w+),/);
                    if (match) {
                        streamDeck.logger.info("Map location found:", match[1]);
                        return match[1];
                    }
                }
            }

            streamDeck.logger.info("No location found in latest file:", latestFile);
            return null;
        } catch (error) {
            streamDeck.logger.error("Error reading logs:", error);
            return null;
        }
    }

    private async getProfilePath(deviceType: number) {
        switch (deviceType) {
            case 0:
                return "Map Info MK V2";
            case 1:
                return "Map Info Mini V2";
            case 2:
                return "Map Info XL V2";
            case 3:
                return "Map Info MK V2";
            case 7:
                return "Map Info Neo V2";
            case 9:
                return "Map Info Neo V2";
            default:
                return '';
        }
    }

    override onDidReceiveSettings(ev: DidReceiveSettingsEvent): void | Promise<void> {
        const { pve_map_mode_check, eft_install_path, map_autoupdate_check } = ev.payload.settings;
        globalThis.pve_map_mode_check = pve_map_mode_check;
        globalThis.eftInstallPath = eft_install_path;
        globalThis.map_autoupdate_check = map_autoupdate_check;

        streamDeck.logger.info("Received settings:", ev.payload.settings);

        const updatedData = {
            global: {
                eft_install_path,
            },
            current_map_info: {
                pve_map_mode_check,
                map_autoupdate_check,
            },
        };

        saveSettings(updatedData);
    }

    override async onSendToPlugin(ev: SendToPluginEvent<any, any>): Promise<void> {
        const payload = ev.payload as any;
        streamDeck.logger.info("onSendToPlugin received:", JSON.stringify(payload));

        if (payload.command === "autoDetectPath") {
            streamDeck.logger.info("Starting auto-detect path...");
            const result = await detectEftPath();
            streamDeck.logger.info("Auto-detect result:", JSON.stringify(result));

            if (result.success && result.path) {
                // Update the action settings with the detected path
                await ev.action.setSettings({
                    ...await ev.action.getSettings(),
                    eft_install_path: result.path
                });

                // Save to global settings
                saveSettings({
                    global: { eft_install_path: result.path }
                });

                // Send success response back to property inspector
                await streamDeck.ui.current?.sendToPropertyInspector({
                    event: "autoDetectResult",
                    success: true,
                    path: result.path
                });
            } else {
                // Send error response
                await streamDeck.ui.current?.sendToPropertyInspector({
                    event: "autoDetectResult",
                    success: false,
                    error: result.error
                });
            }
        } else if (payload.command === "getGlobalSettings") {
            const settings = loadSettings();
            streamDeck.logger.info("Sending global settings:", settings.eftInstallPath);
            await streamDeck.ui.current?.sendToPropertyInspector({
                event: "globalSettings",
                eft_install_path: settings.eftInstallPath
            });
        }
    }
}