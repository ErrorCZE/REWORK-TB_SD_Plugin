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
			
			
		} else {
			
		}
	} catch (error) {
	}
}

// Load settings on startup
loadSettings();

@action({ UUID: "eu.tarkovbot.tools.mapinfo.currentserver" })
export class TarkovCurrentMapInfo_CurrentServer extends SingletonAction {
	private serverInfo: { ip: string, datacenter: string } | null = null;

	override async onWillAppear(ev: WillAppearEvent): Promise<void> {
		
		
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
		}
	}
	
	private async updateServerInfo(): Promise<void> {
		loadSettings();
		try {
			this.serverInfo = await this.getLatestIP(eftInstallPath);
		} catch (error) {
		}
	}

	private updateServerDisplay(ev: WillAppearEvent): void {
		if (this.serverInfo && this.serverInfo.datacenter) {
			const formattedDatacenter = this.serverInfo.datacenter.replace("North America", "NA").replace(" -", "").replace(/ /g, "\n");
			ev.action.setTitle(`\n\n${formattedDatacenter}`);
		} else {
			ev.action.setTitle("\n\nNo\nServer\nFound");
		}
	}
	
	private async getLatestIP(path: string): Promise<{ ip: string, datacenter: string } | null> {
		try {
			if (!path) {
				return null;
			}
			
			const logsPath = `${path}\\Logs`;

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
				return null;
			}

			const latestFolder = `${logsPath}\\${logFolders[0].name}`;

			const files = await fs.promises.readdir(latestFolder, { withFileTypes: true });
			const logFiles = files
				.filter(f => f.isFile() && f.name.includes("application") && f.name.endsWith(".log"))
				.sort((a, b) => b.name.localeCompare(a.name));

			if (logFiles.length === 0) {

				return null;
			}

			const latestFile = `${latestFolder}\\${logFiles[0].name}`;

			const content = await fs.promises.readFile(latestFile, "utf-8");
			const lines = content.split("\n");

			for (let i = lines.length - 1; i >= 0; i--) {
				const match = lines[i].match(/Ip:\s([\d\.]+),/);
				if (match) {
					const ip = match[1];
	

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

			return null;
		} catch (error) {
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
			return 0;
		}
	}

	override onDidReceiveSettings(ev: DidReceiveSettingsEvent): void {
		const { map_autoupdate_check: newAutoUpdate, pve_map_mode_check: newPveMode } = ev.payload.settings;
		
		map_autoupdate_check = newAutoUpdate || false;
		pve_map_mode_check = newPveMode || false;
	
		
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

			}
		} catch (error) {
		}
	}
}