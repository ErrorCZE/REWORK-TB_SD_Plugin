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

let eftInstallPath: any;
let currentServerIP: any;

@action({ UUID: "eu.tarkovbot.tools.raidserver" })
export class TarkovCurrentServerInfo extends SingletonAction {

	override async onWillAppear(ev: WillAppearEvent): Promise<void> {
		ev.action.setTitle(`Press to\nGet\nServer`);
	}

	override async onKeyDown(ev: KeyDownEvent): Promise<void> {
		eftInstallPath = ev.payload.settings.eft_install_path;
		streamDeck.logger.info("Payload settings on keydown: " + JSON.stringify(ev.payload.settings));

		currentServerIP = await this.getLatestIP(eftInstallPath);

		if (currentServerIP) {
			ev.action.setTitle(`IP: ${currentServerIP}`);
		} else {
			ev.action.setTitle(`No\nIP\nFound`);
		}
	}

	private async getLatestIP(path: any): Promise<string | null> {
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
					streamDeck.logger.info("IP found:", match[1]);
					return match[1];
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
		const { eft_install_path } = ev.payload.settings;
		globalThis.eftInstallPath = eft_install_path;

		streamDeck.logger.info("Received settings:", ev.payload.settings);

		const updatedData = {
			global: {
				eft_install_path,
			}
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