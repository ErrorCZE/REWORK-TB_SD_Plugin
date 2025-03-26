import {
    streamDeck,
    action,
    SingletonAction,
    WillAppearEvent,
    WillDisappearEvent,
    DidReceiveSettingsEvent,
} from "@elgato/streamdeck";
import fs from "fs";
import path from "path";

const settingsFilePath = path.join(process.cwd(), "user_settings.json");

let map_autoupdate_check = false;
let pve_map_mode_check = false;
let intervalUpdateInterval: NodeJS.Timeout | null = null;
let lastPveMode: boolean | null = null;

// Global variables to track map changes for all boss instances
let currentGlobalLocationId: string | null = null;
let lastImageFetchMap: string | null = null;
let bossImageCache: Record<string, string> = {};

// Load settings from user_settings.json
function loadSettings(): void {
    try {
        if (fs.existsSync(settingsFilePath)) {
            const fileData = fs.readFileSync(settingsFilePath, "utf8");
            const settings = JSON.parse(fileData);

            map_autoupdate_check = settings.current_map_info?.map_autoupdate_check || false;
            pve_map_mode_check = settings.current_map_info?.pve_map_mode_check || false;
        }
    } catch (error) {
        streamDeck.logger.error("Error loading settings:", error);
    }
}

// Load settings on startup
loadSettings();

@action({ UUID: "eu.tarkovbot.tools.mapinfo.boss" })
export class TarkovCurrentMapInfo_Boss extends SingletonAction {
    private bossIndex: number;
    private activeInstance: boolean = false;
    private updateInterval: NodeJS.Timeout | null = null;

    constructor(bossIndex: number) {
        super();
        this.bossIndex = bossIndex;
    }

    override async onWillAppear(ev: WillAppearEvent): Promise<void> {
        this.activeInstance = true;

        // Clear display on initial appearance
        this.clearBossDisplay(ev);

        // Set up map change tracking interval ONLY if auto-update is enabled
        if (intervalUpdateInterval === null && map_autoupdate_check) {
            currentGlobalLocationId = globalThis.location;

            intervalUpdateInterval = setInterval(() => {
                const newLocationId = globalThis.location;

                if (newLocationId !== currentGlobalLocationId) {
                    bossImageCache = {};
                    lastImageFetchMap = null;
                    currentGlobalLocationId = newLocationId;
                }
            }, 3000);
        }

        // Initial update - Always run this
        await this.updateBossInfo(ev);

        // Set up periodic update ONLY if auto-update is enabled
        if (map_autoupdate_check) {
            this.updateInterval = setInterval(async () => {
                if (!this.activeInstance) {
                    this.clearUpdateInterval();
                    return;
                }
                await this.updateBossInfo(ev);
            }, 5000);
        }
    }

    override onWillDisappear(ev: WillDisappearEvent): void {
        this.activeInstance = false;
        this.clearUpdateInterval();
    }

    private clearUpdateInterval(): void {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    // Helper method to clear the display
    private async clearBossDisplay(ev: WillAppearEvent): Promise<void> {
        ev.action.setTitle("");
        ev.action.setImage("");
    }

    private async updateBossInfo(ev: WillAppearEvent): Promise<void> {
        // Reload settings on each update to detect changes
        loadSettings();

        // Check if PVE mode has changed
        if (lastPveMode !== pve_map_mode_check) {
            lastImageFetchMap = null;
            bossImageCache = {};
            lastPveMode = pve_map_mode_check;
        }

        const locationId = globalThis.location;

        // Do nothing if location is not available
        if (!locationId) {
            ev.action.setTitle("\nUnknown\nLocation");
            return;
        }

        // Get the correct map data source based on settings
        const mapData = pve_map_mode_check
            ? globalThis.locationsDataPVE?.find(map => map.nameId === locationId)
            : globalThis.locationsDataPVP?.find(map => map.nameId === locationId);

        // Handle no map data case
        if (!mapData) {
            ev.action.setTitle("\nNo Map\nData");
            return;
        }

        // Check if bosses array exists and has enough elements
        if (!mapData.bosses || this.bossIndex >= mapData.bosses.length) {
            this.clearBossDisplay(ev);
            return;
        }

        // Get boss data for this index
        const boss = mapData.bosses[this.bossIndex];
        if (!boss) {
            this.clearBossDisplay(ev);
            return;
        }

        // Format boss name
        let bossNameFormatted = boss.name.split(" ").join("\n");

        if (bossNameFormatted === "Knight") bossNameFormatted = "Goons";
        if (bossNameFormatted === "Cultist\nPriest") bossNameFormatted = "Cultists";

        // Set title
        ev.action.setTitle(`${bossNameFormatted}\n${boss.spawnChance}`);

        // Image fetching logic
        // Always attempt to fetch/use image, but only re-fetch when map changes
        if (locationId !== lastImageFetchMap) {
            if (!bossImageCache[boss.id]) {
                const imageUrl = `https://tarkovbot.eu/streamdeck/img/${boss.id}.webp`;
                const fallbackUrl = `https://tarkovbot.eu/streamdeck/img/unknown_boss.webp`;

                try {
                    const base64Image = await this.fetchBase64Image(imageUrl, fallbackUrl);
                    if (base64Image) {
                        bossImageCache[boss.id] = base64Image;
                    }
                } catch (error) {
                    streamDeck.logger.error(`Error fetching boss image for ${boss.id}:`, error);
                }
            }

            if (bossImageCache[boss.id]) {
                ev.action.setImage(bossImageCache[boss.id]);
            }
        } else if (bossImageCache[boss.id]) {
            ev.action.setImage(bossImageCache[boss.id]);
        }

        // Record that we've fetched images for this map
        lastImageFetchMap = locationId;
    }

    private async fetchBase64Image(url: string, fallbackUrl: string): Promise<string | null> {
        try {
            let response = await fetch(url);

            if (!response.ok && fallbackUrl) {
                response = await fetch(fallbackUrl);
            }

            if (!response.ok) {
                return null;
            }

            const arrayBuffer = await response.arrayBuffer();
            return `data:image/webp;base64,${Buffer.from(arrayBuffer).toString("base64")}`;
        } catch (error) {
            streamDeck.logger.error("Failed to fetch image:", error);
            return null;
        }
    }
}