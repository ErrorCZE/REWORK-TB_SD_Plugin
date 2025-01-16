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

// Update ApiResponse to reflect the actual response structure
interface ApiResponse {
    maps: MapData[];
}

const apiURL_PVE = "https://tarkovbot.eu/api/pve/streamdeck/maps";
const apiURL_PVP = "https://tarkovbot.eu/api/streamdeck/maps";

// Update data for PVE
async function refreshDataPVE(): Promise<void> {
    try {
        const response = await fetch(apiURL_PVE);
        const jsonData = await response.json();

        if (isApiResponse(jsonData)) {
            globalThis.locationsDataPVE = jsonData.maps.map(map => {
                const consolidatedBosses: { name: string; spawnChance: string; id: string }[] = [];
                const bossMap = new Map<string, { id: string; spawnChances: number[] }>(); // Map to track spawn chances and ids for each boss

                // Iterate through each boss to consolidate
                map.bosses.forEach(bossData => {
                    const bossName = bossData.boss.name;
                    const bossId = bossData.boss.id;
                    const spawnChance = (bossData.spawnChance * 100).toFixed(0); // Convert to percentage

                    if (!bossMap.has(bossName)) {
                        bossMap.set(bossName, { id: bossId, spawnChances: [] }); // Initialize if not present
                    }
                    bossMap.get(bossName)!.spawnChances.push(spawnChance);
                });

                // Now map the consolidated data
                bossMap.forEach(({ id, spawnChances }, name) => {
                    const lowest = Math.min(...spawnChances);
                    const highest = Math.max(...spawnChances);

                    // If lowest and highest are the same, just use the lowest value
                    const spawnChanceString = lowest === highest ? `${lowest}%` : `${lowest}-${highest}%`;

                    consolidatedBosses.push({ name, spawnChance: spawnChanceString, id }); // Include the id in the final structure
                });

                return {
                    ...map,
                    bosses: consolidatedBosses
                };
            });

            streamDeck.logger.info("Processed PVE Map Data:", globalThis.locationsDataPVE);
        }
    } catch (error) {
        streamDeck.logger.info("Error fetching PVE data:", error);
    }
}





// Update data for PVP
async function refreshDataPVP(): Promise<void> {
    try {
        const response = await fetch(apiURL_PVP);
        const jsonData = await response.json();

        if (isApiResponse(jsonData)) {
            globalThis.locationsDataPVP = jsonData.maps.map(map => {
                const consolidatedBosses: { name: string; spawnChance: string; id: string }[] = [];
                const bossMap = new Map<string, { id: string; spawnChances: number[] }>(); // Map to track spawn chances and ids for each boss

                // Iterate through each boss to consolidate
                map.bosses.forEach(bossData => {
                    const bossName = bossData.boss.name;
                    const bossId = bossData.boss.id;
                    const spawnChance = (bossData.spawnChance * 100).toFixed(0); // Convert to percentage

                    if (!bossMap.has(bossName)) {
                        bossMap.set(bossName, { id: bossId, spawnChances: [] }); // Initialize if not present
                    }
                    bossMap.get(bossName)!.spawnChances.push(spawnChance);
                });

                // Now map the consolidated data
                bossMap.forEach(({ id, spawnChances }, name) => {
                    const lowest = Math.min(...spawnChances);
                    const highest = Math.max(...spawnChances);

                    // If lowest and highest are the same, just use the lowest value
                    const spawnChanceString = lowest === highest ? `${lowest}%` : `${lowest}-${highest}%`;

                    consolidatedBosses.push({ name, spawnChance: spawnChanceString, id }); // Include the id in the final structure
                });

                return {
                    ...map,
                    bosses: consolidatedBosses
                };
            });

            streamDeck.logger.info("Processed PVP Map Data:", globalThis.locationsDataPVP);
        }
    } catch (error) {
        streamDeck.logger.info("Error fetching PVP data:", error);
    }
}


// Type Guard for ApiResponse
function isApiResponse(data: any): data is ApiResponse {
    return (
        data &&
        typeof data === 'object' &&
        Array.isArray(data.maps)
    );
}

refreshDataPVE();
refreshDataPVP();

// Rrrefresh data every 20 minutes
setInterval(refreshDataPVE, 1200000);
setInterval(refreshDataPVP, 1200000);


let eftInstallPath: any;
let intervalUpdateInterval: any;
@action({ UUID: "eu.tarkovbot.tools.mapinfo" })
export class TarkovCurrentMapInfo extends SingletonAction {

    override async onWillAppear(ev: WillAppearEvent): Promise<void> {
        ev.action.setTitle(`Press to\nGet\nMap Info`);
        eftInstallPath = ev.payload.settings.eft_install_path;

        if (ev.payload.settings.map_autoupdate_check) {
            streamDeck.logger.info("Auto-update is enabled");
            // Start a new interval if auto-update is enabled
            intervalUpdateInterval = setInterval(async () => {
                globalThis.location = await this.getLatestMap(eftInstallPath);
                streamDeck.logger.info("Auto-update interval triggered; location:", globalThis.location);
            }, 3000);
        } else {
            // Clear the interval if it exists to stop auto-update
            if (intervalUpdateInterval) {
                clearInterval(intervalUpdateInterval);
                intervalUpdateInterval = null; // Reset the interval variable
            }
            streamDeck.logger.info("Auto-update is disabled");
            // Perform a one-time update if auto-update is disabled
            globalThis.location = await this.getLatestMap(eftInstallPath);
            streamDeck.logger.info("Auto-update disabled; location:", globalThis.location);
        }
    }

    override async onKeyDown(ev: KeyDownEvent): Promise<void> {
        eftInstallPath = ev.payload.settings.eft_install_path;
        streamDeck.logger.info("Payload settings on keydown: " + ev.payload.settings);
        streamDeck.logger.info("Install path from settings (keydown): " + eftInstallPath);

        // Clear any existing interval to prevent multiple intervals from being created
        if (intervalUpdateInterval) {
            clearInterval(intervalUpdateInterval);
            intervalUpdateInterval = null; // Reset the interval variable
        }

        if (ev.payload.settings.map_autoupdate_check) {
            // Start a new interval if auto-update is enabled
            intervalUpdateInterval = setInterval(async () => {
                globalThis.location = await this.getLatestMap(eftInstallPath);
                streamDeck.logger.info("Auto-update interval triggered; location:", globalThis.location);
            }, 3000);
        } else {
            // Clear the interval if it exists to stop auto-update
            if (intervalUpdateInterval) {
                clearInterval(intervalUpdateInterval);
                intervalUpdateInterval = null; // Reset the interval variable
            }
            // Perform a one-time update if auto-update is disabled
            globalThis.location = await this.getLatestMap(eftInstallPath);
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
            let pathEFT = path;
            const logsPath = `${pathEFT}\\Logs`;
            streamDeck.logger.info("Using logs path:", logsPath);

            // Read all folders in the EFT directory
            const folders = await fs.promises.readdir(logsPath, { withFileTypes: true });
            const logFolders = folders
                .filter(f => f.isDirectory() && f.name.startsWith("log_"))
                .map(f => ({
                    dirent: f,
                    timestamp: this.extractTimestamp(f.name)
                }))
                .sort((a, b) => b.timestamp - a.timestamp) // Sort by timestamp descending
                .map(f => f.dirent);

            if (logFolders.length === 0) {
                streamDeck.logger.info("No log folders found");
                return null;
            }

            // Get the most recent folder
            const latestFolder = `${logsPath}\\${logFolders[0].name}`;
            streamDeck.logger.info("Checking latest log folder:", latestFolder);

            // Read all files in the latest log folder
            const files = await fs.promises.readdir(latestFolder, { withFileTypes: true });
            const logFiles = files
                .filter(f => f.isFile() && f.name.includes("application") && f.name.endsWith(".log"))
                .sort((a, b) => b.name.localeCompare(a.name)); // Sort log files in descending order

            if (logFiles.length === 0) {
                streamDeck.logger.info("No log files found in folder:", latestFolder);
                return null;
            }

            // Read only the latest log file
            const latestFile = `${latestFolder}\\${logFiles[0].name}`;
            streamDeck.logger.info("Reading latest log file:", latestFile);

            const content = await fs.promises.readFile(latestFile, "utf-8");
            const lines = content.split("\n");

            // Search each line in reverse order to find the latest map location
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
            streamDeck.logger.info("Error reading logs:", error);
            return null;
        }
    }

    private extractTimestamp(folderName: string): number {
        try {
            // Extract date and time parts from folder name
            // Example format: log_2024.12.31_20-35-24_0.16.0.2.34501
            const match = folderName.match(/^log_(\d{4})\.(\d{2})\.(\d{2})_(\d{2})-(\d{2})-(\d{2})/);
            if (match) {
                const [_, year, month, day, hour, minute, second] = match;
                // Create a Date object using the extracted components
                const date = new Date(
                    parseInt(year),
                    parseInt(month) - 1, // Months are 0-based in JavaScript
                    parseInt(day),
                    parseInt(hour),
                    parseInt(minute),
                    parseInt(second)
                );
                return date.getTime();
            }
            return 0;
        } catch (error) {
            streamDeck.logger.info("Error parsing timestamp:", error);
            return 0;
        }
    }


    private async getProfilePath(deviceType: number) {
        switch (deviceType) {
            case 0:
                return "Map Info MK"
            case 1:
                return "Map Info Mini"
            case 2:
                return "Map Info XL"
            case 3:
                return "Map Info MK"
            case 7:
                return "Map Info Neo"
            case 8:
                return "Map Info Neo"
            default:
                return '';
        }
    }


    // Update global settings when received
    override onDidReceiveSettings(ev: DidReceiveSettingsEvent): void | Promise<void> {
        const { pve_map_mode_check, eft_install_path, map_autoupdate_check } = ev.payload.settings;
        globalThis.pve_map_mode_check = pve_map_mode_check;
        globalThis.eftInstallPath = eft_install_path;
        globalThis.map_autoupdate_check = map_autoupdate_check;
    
        streamDeck.logger.info("Received settings:", ev.payload.settings);
    
        // Prepare the data to be updated
        const updatedData = {
            global: {
                eft_install_path,
            },
            current_map_info: {
                pve_map_mode_check,
                map_autoupdate_check,
            },
        };
    
        // Define the path to the user_settings.json file
        const settingsFilePath = path.join(process.cwd(), 'user_settings.json');
    
        // Read the existing file, update it, and save back
        fs.readFile(settingsFilePath, 'utf8', (readErr, fileData) => {
            let existingData = {};
    
            if (!readErr) {
                try {
                    existingData = JSON.parse(fileData); // Parse existing JSON
                } catch (parseErr) {
                    streamDeck.logger.error("Error parsing user_settings.json:", parseErr);
                }
            }
    
            // Merge existing settings with the updated data
            const mergedData = { ...existingData, ...updatedData };
    
            // Write the merged data back to the file
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

