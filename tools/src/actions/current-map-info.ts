import {
    action,
    SingletonAction,
    WillAppearEvent,
    KeyDownEvent,
    DidReceiveSettingsEvent,
    WillDisappearEvent,
    JsonObject
} from "@elgato/streamdeck";
import fs from "fs";



const apiURL = "https://tarkovbot.eu/api/bosses";
//! Backend - Přidat PVE endpoint

@action({ UUID: "eu.tarkovbot.tools.mapinfo" })
export class TarkovCurrentMapInfo extends SingletonAction {

    override onWillAppear(ev: WillAppearEvent): void | Promise<void> {
        ev.action.setTitle(`Press to\nGet\nMap Info`);
    };

    override async onKeyDown(ev: KeyDownEvent): Promise<void> {
        const location = await this.getLatestMap();
        if (location) {
            ev.action.setTitle(location.toLowerCase());
        } else {
            ev.action.setTitle("Not\nFound");
        }
    }

    private async getLatestMap(): Promise<string | null> {
        const logsPath = "C:\\Battlestate Games\\EFT\\Logs"; //TODO: Přidat settings možnost pro vlastní cestu, tohle použít jako default, když si nic nezadá

        const folders = await fs.promises.readdir(logsPath, { withFileTypes: true });
        const logFolders = folders
            .filter(f => f.isDirectory() && f.name.startsWith("log_"))
            .sort((a, b) => b.name.localeCompare(a.name));

        for (const folder of logFolders) {
            const latestFolder = `${logsPath}\\${folder.name}`;
            const files = await fs.promises.readdir(latestFolder, { withFileTypes: true });
            const logFiles = files
                .filter(f => f.isFile() && f.name.endsWith(".log"))
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

