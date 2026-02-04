import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";

const execAsync = promisify(exec);

const REGISTRY_PATHS = [
	"HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\EscapeFromTarkov",
	"HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Steam App 3932890"
];

/**
 * Detect EFT installation path from Windows Registry
 * Checks both regular and Steam installation paths
 */
export async function detectEftPath(): Promise<{ success: boolean; path?: string; error?: string }> {
	for (const regPath of REGISTRY_PATHS) {
		try {
			const { stdout } = await execAsync(`reg query "${regPath}" /v InstallLocation`, {
				encoding: "utf8"
			});

			// Parse the registry output to get the install path
			const match = stdout.match(/InstallLocation\s+REG_SZ\s+(.+)/i);
			if (match && match[1]) {
				const installPath = match[1].trim();

				// Check if Logs folder exists
				let logsPath = `${installPath}\\Logs`;
				if (!fs.existsSync(logsPath)) {
					logsPath = `${installPath}\\build\\Logs`;
				}

				if (fs.existsSync(logsPath)) {
					// Return the install path (without \Logs)
					const basePath = logsPath.replace(/\\Logs$/, "").replace(/\\build\\Logs$/, "");
					return { success: true, path: basePath.includes("\\build") ? `${installPath}\\build` : installPath };
				}
			}
		} catch (error) {
			// Registry key doesn't exist or error reading, continue to next path
			continue;
		}
	}

	return {
		success: false,
		error: "EFT installation not found. Please enter the path manually."
	};
}
