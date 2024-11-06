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

const apiURL_PVE = "https://tarkovbot.eu/api/pve/bosses";
const apiURL_PVP = "https://tarkovbot.eu/api/bosses";

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
                    const spawnChance = bossData.spawnChance;

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
                    const spawnChanceString = lowest === highest ? `${lowest}` : `${lowest}-${highest}`;
                    
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
                const consolidatedBosses: { name: string; spawnChance: string }[] = [];
                const bossMap = new Map<string, number[]>(); // Map to track spawn chances for each boss

                // Iterate through each boss to consolidate
                map.bosses.forEach(bossData => {
                    const bossName = bossData.boss.name;
                    const spawnChance = bossData.spawnChance;

                    if (!bossMap.has(bossName)) {
                        bossMap.set(bossName, []); // Initialize if not present
                    }
                    bossMap.get(bossName)!.push(spawnChance);
                });

                // Now map the consolidated data
                bossMap.forEach((spawnChances, name) => {
                    const lowest = Math.min(...spawnChances);
                    const highest = Math.max(...spawnChances);
                    const spawnChanceString = spawnChances.length > 1 ? `${lowest}-${highest}` : `${lowest}`;
                    consolidatedBosses.push({ name, spawnChance: spawnChanceString });
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
//refreshDataPVP();



@action({ UUID: "eu.tarkovbot.tools.mapinfo" })
export class TarkovCurrentMapInfo extends SingletonAction {

    override onWillAppear(ev: WillAppearEvent): void | Promise<void> {
        ev.action.setTitle(`Press to\nGet\nMap Info`);
    };

    override async onKeyDown(ev: KeyDownEvent): Promise<void> {
        globalThis.location = await this.getLatestMap();
        if (globalThis.location) {
            ev.action.setTitle(globalThis.location.toLowerCase());
            streamDeck.profiles.switchToProfile(ev.action.device.id, "Map Info XL");
        } else {
            ev.action.setTitle("Not\nFound");
        }
    }

    private async getLatestMap(): Promise<string | null> {
        const logsPath = "C:\\Battlestate Games\\EFT\\Logs"; //TODO: Přidat settings možnost pro vlastní cestu, tohle použít jako default

        const folders = await fs.promises.readdir(logsPath, { withFileTypes: true });
        const logFolders = folders
            .filter(f => f.isDirectory() && f.name.startsWith("log_"))
            .sort((a, b) => b.name.localeCompare(a.name));

        for (const folder of logFolders) {
            const latestFolder = `${logsPath}\\${folder.name}`;
            const files = await fs.promises.readdir(latestFolder, { withFileTypes: true });
            const logFiles = files
                .filter(f => f.isFile() && f.name.includes("application") && f.name.endsWith(".log"))
                .sort((a, b) => b.name.localeCompare(a.name));

            for (const file of logFiles) {
                const latestFile = `${latestFolder}\\${file.name}`;
                const content = await fs.promises.readFile(latestFile, "utf-8");
                const lines = content.split("\n");

                for (let i = lines.length - 1; i >= 0; i--) {
                    const match = lines[i].match(/Location:\s(\w+),/);
                    if (match) {
                        return match[1];
                    }
                }
            }
        }
        return null;
    }

}

