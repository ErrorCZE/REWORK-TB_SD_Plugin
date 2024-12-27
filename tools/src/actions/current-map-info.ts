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


let eftInstallPath;
@action({ UUID: "eu.tarkovbot.tools.mapinfo" })
export class TarkovCurrentMapInfo extends SingletonAction {

    override onWillAppear(ev: WillAppearEvent): void | Promise<void> {
        ev.action.setTitle(`Press to\nGet\nMap Info`);
    }

    override async onKeyDown(ev: KeyDownEvent): Promise<void> {
        eftInstallPath = ev.payload.settings.eft_install_path;
        streamDeck.logger.info("Payload settings on keydown: "+ev.payload.settings);
        streamDeck.logger.info("Install path from settings (keydown): " + eftInstallPath);
        globalThis.location = await this.getLatestMap(eftInstallPath);

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
            // Define the path to the EFT installation folder
            const logsPath = `${pathEFT}\\Logs`;
            streamDeck.logger.info("Using logs path:", logsPath);
    
            // Read all folders in the EFT directory
            const folders = await fs.promises.readdir(logsPath, { withFileTypes: true });
            const logFolders = folders
                .filter(f => f.isDirectory() && f.name.startsWith("log_"))
                .sort((a, b) => {
                    // Extract timestamps from folder names
                    const timeA = this.extractTimestamp(a.name);
                    const timeB = this.extractTimestamp(b.name);
    
                    // Compare timestamps in descending order
                    return timeB - timeA;
                });
    
            streamDeck.logger.info("Found log folders:", logFolders.map(f => f.name));
    
            for (const folder of logFolders) {
                const latestFolder = `${logsPath}\\${folder.name}`;
                streamDeck.logger.info("Checking log folder:", latestFolder);
    
                // Read all files in the latest log folder
                const files = await fs.promises.readdir(latestFolder, { withFileTypes: true });
                const logFiles = files
                    .filter(f => f.isFile() && f.name.includes("application") && f.name.endsWith(".log"))
                    .sort((a, b) => b.name.localeCompare(a.name));  // Sort log files in descending order
    
                streamDeck.logger.info("Found log files:", logFiles.map(f => f.name));
    
                for (const file of logFiles) {
                    const latestFile = `${latestFolder}\\${file.name}`;
                    streamDeck.logger.info("Reading log file:", latestFile);
    
                    const content = await fs.promises.readFile(latestFile, "utf-8");
                    const lines = content.split("\n");
    
                    // Search each line in reverse order to find the latest map location
                    for (let i = lines.length - 1; i >= 0; i--) {
                        const match = lines[i].match(/Location:\s(\w+),/);
                        if (match) {
                            streamDeck.logger.info("Map location found:", match[1]);
                            return match[1];  // Return the matched location
                        }
                    }
                    streamDeck.logger.info("No location found in file:", latestFile);
                }
            }
        } catch (error) {
            streamDeck.logger.info("Error reading logs:", error);
        }
    
        streamDeck.logger.info("No map location found after scanning all logs.");
        return null;  // Return null if no map location is found
    }
    
    // Helper function to extract and parse the timestamp from folder names
    private extractTimestamp(folderName: string): number {
        const match = folderName.match(/^log_(\d{4}\.\d{2}\.\d{2}_\d{1,2}-\d{1,2}-\d{1,2})/);
        if (match) {
            // Replace '-' with ':' to form a valid date-time string
            const dateTime = match[1].replace(/-/g, ":");
            return new Date(dateTime).getTime(); // Convert to timestamp
        }
        return 0; // Default to 0 if no valid timestamp is found
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
        const { pve_map_mode_check, eft_install_path } = ev.payload.settings;
        globalThis.pve_map_mode_check = pve_map_mode_check;
        eftInstallPath = eft_install_path;

        streamDeck.logger.info("Received settings:", ev.payload.settings);
    }


}

