import {
    streamDeck,
    action,
    SingletonAction,
    WillAppearEvent,
    KeyDownEvent,
    DidReceiveSettingsEvent,
    WillDisappearEvent,
    SendToPluginEvent,
} from "@elgato/streamdeck";
import fs from "fs";
import path from "path";
import { saveSettings, loadSettings } from "../utils/settings";
import { extractTimestamp, findServerFromLogs } from "../utils/log-parser";
import { detectEftPath } from "../utils/eft-path";


let eftInstallPath: any;
let currentServerInfo: any;
let intervalUpdateInterval: any;


const datacenterAPI = "https://tarkovbot.eu/api/streamdeck/v2/eft-datacenters";
let datacenterData: Record<string, { datacenter: string; sids: string[] }[]> = {};

async function refreshDatacenterData(): Promise<void> {
    try {
        const response = await fetch(datacenterAPI);
        const jsonData = await response.json();

        if (jsonData && typeof jsonData === "object") {
            datacenterData = jsonData as Record<string, { datacenter: string; sids: string[] }[]>;
            globalThis.datacentersData = datacenterData;
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
        ev.action.setTitle(`Get\nCurrent\nServer`);
    }

    override async onKeyDown(ev: KeyDownEvent): Promise<void> {
        ev.action.setTitle(`Loading...`);
        const { eft_install_path, raid_autoupdate_check } = ev.payload.settings;

        if (intervalUpdateInterval) {
            clearInterval(intervalUpdateInterval);
            intervalUpdateInterval = null;
        }

        const updateUI = async () => {
            const info = await findServerFromLogs((eft_install_path as string));
            if (info) {
                const formatted = info.datacenter
                    .replace("North America", "NA")
                    .replace(" -", "")
                    .replace(/ /g, "\n");
                ev.action.setTitle(formatted);
            } else {
                ev.action.setTitle(`No\nServer\nFound`);
            }
            return info;
        };

        if (raid_autoupdate_check) {
            intervalUpdateInterval = setInterval(updateUI, 3000);
        } else {
            const info = await updateUI();
            if (info) {
                setTimeout(() => ev.action.setTitle(`Get\nCurrent\nServer`), 5000);
            }
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

        saveSettings(updatedData);
    }

    override onWillDisappear(ev: WillDisappearEvent): void | Promise<void> {
        if (intervalUpdateInterval) {
            clearInterval(intervalUpdateInterval);
            intervalUpdateInterval = null;
        }
    }

    override async onSendToPlugin(ev: SendToPluginEvent<any, any>): Promise<void> {
        const payload = ev.payload as any;
        streamDeck.logger.info("onSendToPlugin received:", JSON.stringify(payload));

        if (payload.command === "autoDetectPath") {
            streamDeck.logger.info("Starting auto-detect path...");
            const result = await detectEftPath();
            streamDeck.logger.info("Auto-detect result:", JSON.stringify(result));

            if (result.success && result.path) {
                // Update the action settings with the detected path
                await ev.action.setSettings({
                    ...await ev.action.getSettings(),
                    eft_install_path: result.path
                });

                // Save to global settings
                saveSettings({
                    global: { eft_install_path: result.path }
                });

                // Send success response back to property inspector
                await streamDeck.ui.current?.sendToPropertyInspector({
                    event: "autoDetectResult",
                    success: true,
                    path: result.path
                });
            } else {
                // Send error response
                await streamDeck.ui.current?.sendToPropertyInspector({
                    event: "autoDetectResult",
                    success: false,
                    error: result.error
                });
            }
        } else if (payload.command === "getGlobalSettings") {
            const settings = loadSettings();
            streamDeck.logger.info("Sending global settings:", settings.eftInstallPath);
            await streamDeck.ui.current?.sendToPropertyInspector({
                event: "globalSettings",
                eft_install_path: settings.eftInstallPath
            });
        }
    }
}