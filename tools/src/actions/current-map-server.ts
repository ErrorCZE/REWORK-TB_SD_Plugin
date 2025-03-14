import {
	streamDeck,
	action,
	SingletonAction,
	WillAppearEvent,
	WillDisappearEvent,
	DidReceiveSettingsEvent,
	KeyDownEvent
} from "@elgato/streamdeck";
import fs from "fs";
import path from "path";

const settingsFilePath = path.join(process.cwd(), "user_settings.json");

let map_autoupdate_check = false;
let pve_map_mode_check = false;
let eftInstallPath: string;
let intervalUpdateInterval: NodeJS.Timeout | null = null;

// Load settings from user_settings.json
function loadSettings(): void {
	try {
		if (fs.existsSync(settingsFilePath)) {
			const fileData = fs.readFileSync(settingsFilePath, "utf8");
			const settings = JSON.parse(fileData);

			map_autoupdate_check = settings.current_map_info?.map_autoupdate_check || false;
			pve_map_mode_check = settings.current_map_info?.pve_map_mode_check || false;
			eftInstallPath = settings.global?.eft_install_path || "";
			
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

@action({ UUID: "eu.tarkovbot.tools.mapinfo.currentserver" })
export class TarkovCurrentMapInfo_CurrentServer extends SingletonAction {
	private serverInfo: { ip: string, datacenter: string } | null = null;

	override async onWillAppear(ev: WillAppearEvent): Promise<void> {
		streamDeck.logger.info("onWillAppear triggered for Server Info.");
		
		// Initial update
		await this.updateServerInfo();
		this.updateServerDisplay(ev);

		if (intervalUpdateInterval) {
			clearInterval(intervalUpdateInterval);
			intervalUpdateInterval = null;
		}

		if (map_autoupdate_check) {
			intervalUpdateInterval = setInterval(async () => {
				await this.updateServerInfo();
				this.updateServerDisplay(ev);
			}, 5000);
			streamDeck.logger.info("Auto-update enabled (every 5 sec).");
		} else {
			streamDeck.logger.info("Auto-update is disabled.");
		}
	}
	
	override async onKeyDown(ev: KeyDownEvent): Promise<void> {
		ev.action.setTitle("Loading...");
		await this.updateServerInfo();
		this.updateServerDisplay(ev);
	}

	override onWillDisappear(ev: WillDisappearEvent): void {
		if (intervalUpdateInterval) {
			clearInterval(intervalUpdateInterval);
			intervalUpdateInterval = null;
			streamDeck.logger.info("Auto-update stopped (onWillDisappear).");
		}
	}
	
	private async updateServerInfo(): Promise<void> {
		try {
			this.serverInfo = await this.getLatestIP(eftInstallPath);
			streamDeck.logger.info("Server info updated:", this.serverInfo);
		} catch (error) {
			streamDeck.logger.error("Error updating server info:", error);
		}
	}

	private updateServerDisplay(ev: WillAppearEvent): void {
		if (this.serverInfo && this.serverInfo.datacenter) {
			// Format datacenter name by replacing spaces with newlines
			const formattedDatacenter = this.serverInfo.datacenter.replace(/ /g, "\n");
			ev.action.setTitle(`\n${formattedDatacenter}`);
			streamDeck.logger.info(`Updated datacenter display: ${this.serverInfo.datacenter}`);
		} else {
			ev.action.setTitle("No\nServer\nFound");
			streamDeck.logger.info("No server information available");
		}
	}
	
	private async getLatestIP(path: string): Promise<{ ip: string, datacenter: string } | null> {
		try {
			if (!path) {
				streamDeck.logger.warn("No EFT install path specified");
				return null;
			}
			
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
					const datacenterData = globalThis.datacentersData;
					
					if (datacenterData) {
						for (const region in datacenterData) {
							for (const dc of datacenterData[region]) {
								if (dc.unique_ips.includes(ip)) {
									datacenterName = dc.datacenter;
									break;
								}
							}
							if (datacenterName !== "Unknown") break;
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

	override onDidReceiveSettings(ev: DidReceiveSettingsEvent): void {
		const { map_autoupdate_check: newAutoUpdate, pve_map_mode_check: newPveMode } = ev.payload.settings;
		
		map_autoupdate_check = newAutoUpdate || false;
		pve_map_mode_check = newPveMode || false;
		
		streamDeck.logger.info("Received settings:", ev.payload.settings);
		
		// Update the settings file
		try {
			let existingData = {};
			if (fs.existsSync(settingsFilePath)) {
				const fileData = fs.readFileSync(settingsFilePath, "utf8");
				existingData = JSON.parse(fileData);
			}
			
			const updatedData = {
				...existingData,
				current_map_info: {
					...existingData["current_map_info"],
					map_autoupdate_check,
					pve_map_mode_check
				}
			};
			
			fs.writeFileSync(settingsFilePath, JSON.stringify(updatedData, null, 4));
			streamDeck.logger.info("Settings successfully updated in user_settings.json");
			
			// Restart interval if needed
			if (intervalUpdateInterval) {
				clearInterval(intervalUpdateInterval);
				intervalUpdateInterval = null;
			}
			
			if (map_autoupdate_check) {
				intervalUpdateInterval = setInterval(async () => {
					await this.updateServerInfo();
					this.updateServerDisplay(ev.action);
				}, 5000);
				streamDeck.logger.info("Auto-update restarted with new settings.");
			}
		} catch (error) {
			streamDeck.logger.error("Error updating settings:", error);
		}
	}
}