import {
    streamDeck,
    action,
    SingletonAction,
    WillAppearEvent,
    KeyDownEvent,
    DidReceiveSettingsEvent,
    WillDisappearEvent,
    JsonObject
} from "@elgato/streamdeck";
import fs from "fs";
import path from "path";

interface BossHealth {
    bodyPart: string;
    max: number;
}

interface Boss {
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

interface ApiResponse {
    maps: MapData[];
}

const apiURLs = {
    PVE: "https://tarkovbot.eu/api/pve/streamdeck/maps",
    PVP: "https://tarkovbot.eu/api/streamdeck/maps"
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

refreshData('PVE');
refreshData('PVP');

setInterval(() => refreshData('PVE'), 1200000);
setInterval(() => refreshData('PVP'), 1200000);

let eftInstallPath: any;
let intervalUpdateInterval: any;

@action({ UUID: "eu.tarkovbot.tools.mapinfo" })
export class TarkovCurrentMapInfo extends SingletonAction {

    override async onWillAppear(ev: WillAppearEvent): Promise<void> {
        ev.action.setTitle(`Press to\nGet\nMap Info`);
    }

    override async onKeyDown(ev: KeyDownEvent): Promise<void> {
        eftInstallPath = ev.payload.settings.eft_install_path;
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

    private async getLatestMap(path: any): Promise<string | null> {
        try {
            const logsPath = `${path}\\Logs`;
            streamDeck.logger.info("Using logs path:", logsPath);

            const folders = await fs.promises.readdir(logsPath, { withFileTypes: true });
            const logFolders = folders
                .filter(f => f.isDirectory() && f.name.startsWith("log_"))
                .map(f => ({
                    dirent: f,
                    timestamp: this.extractTimestamp(f.name)
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

            for (let i = lines.length - 1; i >= 0; i--) {
                const match = lines[i].match(/Location:\s(\w+),/);
                if (match) {
                    streamDeck.logger.info("Map location found:", match[1]);
                    return match[1];
                }
            }

            streamDeck.logger.info("No location found in latest file:", latestFile);
            return null;
        } catch (error) {
            streamDeck.logger.error("Error reading logs:", error);
            return null;
        }
    }

    private extractTimestamp(folderName: string): number {
        try {
            const match = folderName.match(/^log_(\d{4})\.(\d{2})\.(\d{2})_(\d{2})-(\d{2})-(\d{2})/);
            if (match) {
                const [_, year, month, day, hour, minute, second] = match;
                const date = new Date(
                    parseInt(year),
                    parseInt(month) - 1,
                    parseInt(day),
                    parseInt(hour),
                    parseInt(minute),
                    parseInt(second)
                );
                return date.getTime();
            }
            return 0;
        } catch (error) {
            streamDeck.logger.error("Error parsing timestamp:", error);
            return 0;
        }
    }

    private async getProfilePath(deviceType: number) {
        switch (deviceType) {
            case 0:
                return "Map Info MK";
            case 1:
                return "Map Info Mini";
            case 2:
                return "Map Info XL";
            case 3:
                return "Map Info MK";
            case 7:
                return "Map Info Neo";
            case 9:
                return "Map Info Neo";
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

        const settingsFilePath = path.join(process.cwd(), 'user_settings.json');

        fs.readFile(settingsFilePath, 'utf8', (readErr, fileData) => {
            let existingData = {};

            if (!readErr) {
                try {
                    existingData = JSON.parse(fileData);
                } catch (parseErr) {
                    streamDeck.logger.error("Error parsing user_settings.json:", parseErr);
                }
            }

            const mergedData = { ...existingData, ...updatedData };

            fs.writeFile(settingsFilePath, JSON.stringify(mergedData, null, 4), (writeErr) => {
                if (writeErr) {
                    streamDeck.logger.error("Error writing to user_settings.json:", writeErr);
                } else {
                    streamDeck.logger.info("Settings successfully updated in user_settings.json");
                }
            });
        });
    }
 
}