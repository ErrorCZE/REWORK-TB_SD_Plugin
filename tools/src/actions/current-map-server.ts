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
import { loadSettings, saveSettings, SETTINGS_FILE_PATH } from "../utils/settings";
import { findServerFromLogs } from "../utils/log-parser";

let intervalUpdateInterval: NodeJS.Timeout | null = null;

@action({ UUID: "eu.tarkovbot.tools.mapinfo.currentserver" })
export class TarkovCurrentMapInfo_CurrentServer extends SingletonAction {
	private serverInfo: { sid: string, datacenter: string } | null = null;

	override async onWillAppear(ev: WillAppearEvent): Promise<void> {
		// Initial update
		await this.updateServerInfo();
		this.updateServerDisplay(ev);

		if (intervalUpdateInterval) {
			clearInterval(intervalUpdateInterval);
			intervalUpdateInterval = null;
		}

		const settings = loadSettings();
		if (settings.map_autoupdate_check) {
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
		const settings = loadSettings();
		try {
			this.serverInfo = await findServerFromLogs(settings.eftInstallPath);
		} catch (error) {
			// Silent fail
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

	override onDidReceiveSettings(ev: DidReceiveSettingsEvent): void {
		const { map_autoupdate_check: newAutoUpdate, pve_map_mode_check: newPveMode } = ev.payload.settings;

		// Update the settings file
		try {
			let existingData: Record<string, any> = {};
			if (fs.existsSync(SETTINGS_FILE_PATH)) {
				const fileData = fs.readFileSync(SETTINGS_FILE_PATH, "utf8");
				existingData = JSON.parse(fileData);
			}

			const updatedData = {
				...existingData,
				current_map_info: {
					...existingData["current_map_info"],
					map_autoupdate_check: newAutoUpdate || false,
					pve_map_mode_check: newPveMode || false
				}
			};

			fs.writeFileSync(SETTINGS_FILE_PATH, JSON.stringify(updatedData, null, 4));

			// Restart interval if needed
			if (intervalUpdateInterval) {
				clearInterval(intervalUpdateInterval);
				intervalUpdateInterval = null;
			}

			if (newAutoUpdate) {
				intervalUpdateInterval = setInterval(async () => {
					await this.updateServerInfo();
					this.updateServerDisplay(ev.action);
				}, 5000);
			}
		} catch (error) {
			// Silent fail
		}
	}
}