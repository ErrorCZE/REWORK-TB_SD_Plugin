import fs from "fs";
import path from "path";

export const SETTINGS_FILE_PATH = path.join(process.cwd(), "user_settings.json");

export interface UserSettings {
	map_autoupdate_check: boolean;
	pve_map_mode_check: boolean;
	eftInstallPath: string;
}

/**
 * Load settings from user_settings.json
 */
export function loadSettings(): UserSettings {
	try {
		if (fs.existsSync(SETTINGS_FILE_PATH)) {
			const fileData = fs.readFileSync(SETTINGS_FILE_PATH, "utf8");
			const settings = JSON.parse(fileData);

			return {
				map_autoupdate_check: settings.current_map_info?.map_autoupdate_check || false,
				pve_map_mode_check: settings.current_map_info?.pve_map_mode_check || false,
				eftInstallPath: settings.global?.eft_install_path || ""
			};
		}
	} catch (error) {
		// Silent fail, return defaults
	}

	return {
		map_autoupdate_check: false,
		pve_map_mode_check: false,
		eftInstallPath: ""
	};
}

/**
 * Save settings to user_settings.json, merging with existing data
 */
export function saveSettings(updates: Record<string, any>): void {
	try {
		let existingData: Record<string, any> = {};
		if (fs.existsSync(SETTINGS_FILE_PATH)) {
			const fileData = fs.readFileSync(SETTINGS_FILE_PATH, "utf8");
			existingData = JSON.parse(fileData);
		}

		const mergedData = { ...existingData, ...updates };
		fs.writeFileSync(SETTINGS_FILE_PATH, JSON.stringify(mergedData, null, 4));
	} catch (error) {
		// Silent fail
	}
}
