import {
    streamDeck,
    action,
    SingletonAction,
    WillAppearEvent,
    KeyDownEvent,
    DidReceiveSettingsEvent,
    WillDisappearEvent,
} from "@elgato/streamdeck";
import fs from "fs";
import path from "path";

let eftInstallPath: any;
let currentServerInfo: any;
let intervalUpdateInterval: any;


const datacenterAPI = "https://tarkovbot.eu/api/streamdeck/eft-datacenters";
let datacenterData: Record<string, { datacenter: string; unique_ips: string[] }[]> = {};

async function refreshDatacenterData(): Promise<void> {
    try {
        const response = await fetch(datacenterAPI);
        const jsonData = await response.json();

        if (jsonData && typeof jsonData === "object") {
            datacenterData = jsonData;
            streamDeck.logger.info("Datacenter list updated.");
        }
    } catch (error) {
        streamDeck.logger.error("Error fetching datacenter data:", error);
    }
}

refreshDatacenterData();
setInterval(refreshDatacenterData, 3600000);




@action({ UUID: "eu.tarkovbot.tools.raidserver" })
export class TarkovCurrentServerInfo extends SingletonAction {

    override async onWillAppear(ev: WillAppearEvent): Promise<void> {
        ev.action.setTitle(`Press to\nGet\nServer`);
    }

    override async onKeyDown(ev: KeyDownEvent): Promise<void> {
        ev.action.setTitle(`Loading...`);
        eftInstallPath = ev.payload.settings.eft_install_path;
        streamDeck.logger.info("Payload settings on keydown: " + JSON.stringify(ev.payload.settings));

        if (intervalUpdateInterval) {
            clearInterval(intervalUpdateInterval);
            intervalUpdateInterval = null;
        }

        if (ev.payload.settings.raid_autoupdate_check) {
            intervalUpdateInterval = setInterval(async () => {
                currentServerInfo = await this.getLatestIP(eftInstallPath);
                streamDeck.logger.info("Auto-update interval triggered; IP:", currentServerInfo);

                if (currentServerInfo) {
                    const formattedDatacenter = currentServerInfo.datacenter.replace(/ /g, "\n");
                    ev.action.setTitle(formattedDatacenter);
                } else {
                    ev.action.setTitle(`No\nIP\nFound`);
                }
            }, 3000);
        } else {
            currentServerInfo = await this.getLatestIP(eftInstallPath);
            streamDeck.logger.info("Auto-update disabled; IP:", currentServerInfo);

            if (currentServerInfo) {
                const formattedDatacenter = currentServerInfo.datacenter.replace(/ /g, "\n");
                ev.action.setTitle(formattedDatacenter);
                // Wait 5 seconds and then set title again to press
                setTimeout(() => {
                    ev.action.setTitle(`Press to\nGet\nServer`);
                }, 5000)
            } else {
                ev.action.setTitle(`No\nIP\nFound`);
            }
        }
    }

    private async getLatestIP(path: any): Promise<{ ip: string, datacenter: string } | null> {
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
                const match = lines[i].match(/Ip:\s([\d\.]+),/);
                if (match) {
                    const ip = match[1];
                    streamDeck.logger.info("IP found:", ip);

                    // Find corresponding datacenter
                    let datacenterName = "Unknown";
                    for (const region in datacenterData) {
                        for (const dc of datacenterData[region]) {
                            if (dc.unique_ips.includes(ip)) {
                                datacenterName = dc.datacenter;
                                break;
                            }
                        }
                    }

                    return { ip, datacenter: datacenterName };
                }
            }

            streamDeck.logger.info("No IP found in latest file:", latestFile);
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

    override onDidReceiveSettings(ev: DidReceiveSettingsEvent): void | Promise<void> {
        const { eft_install_path, raid_autoupdate_check } = ev.payload.settings;
        globalThis.eftInstallPath = eft_install_path;
        globalThis.raid_autoupdate_check = raid_autoupdate_check;

        streamDeck.logger.info("Received settings:", ev.payload.settings);

        const updatedData = {
            global: {
                eft_install_path,
            },
            current_server_info: {
                raid_autoupdate_check,
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

    override onWillDisappear(ev: WillDisappearEvent): void | Promise<void> {
        if (intervalUpdateInterval) {
            clearInterval(intervalUpdateInterval);
            intervalUpdateInterval = null;
        }
    }
}