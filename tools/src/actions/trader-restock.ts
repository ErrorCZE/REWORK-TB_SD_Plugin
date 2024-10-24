import {
    action,
    SingletonAction,
    WillAppearEvent,
    DidReceiveSettingsEvent,
    WillDisappearEvent,
    JsonObject
} from "@elgato/streamdeck";

interface TraderData {
    name: string;
    resetTime: string;
}

interface TraderSettings extends JsonObject {
    selectedTrader?: string;
    pve_traders_mode_check?: boolean;
}



const apiURL_PVE = "https://tarkovbot.eu/api/pve/trader-resets/";
const apiURL_PVP = "https://tarkovbot.eu/api/trader-resets/";

let data_PVE: TraderData[] = [];
let data_PVP: TraderData[] = [];

async function refreshDataPVE(): Promise<void> {
    try {
        const response = await fetch(apiURL_PVE);
        const jsonData = await response.json();
        data_PVE = jsonData.data.traders;
    } catch (error) {
        console.error("Error fetching PVE data:", error);
        data_PVE = [];
    }
}

async function refreshDataPVP(): Promise<void> {
    try {
        const response = await fetch(apiURL_PVP);
        const jsonData = await response.json();
        data_PVP = jsonData.data.traders;
    } catch (error) {
        console.error("Error fetching PVP data:", error);
        data_PVP = [];
    }
}

refreshDataPVP();
refreshDataPVE();
setInterval(refreshDataPVP, 900000);
setInterval(refreshDataPVE, 900000);

@action({ UUID: "eu.tarkovbot.tools.traderrestock" })
export class TarkovTraderRestock extends SingletonAction {
    private updateInterval: NodeJS.Timeout | null = null;

    private updateTitleAndImage(action: any, restockData?: TraderData): void {
        if (!restockData) {
            action.setTitle("\n\n\nNo Data");
            return;
        }

        const resetTime = new Date(restockData.resetTime);
        const currentTime = new Date();
        const timeDifference = resetTime.getTime() - currentTime.getTime();

        if (timeDifference > 0) {
            const hours = String(Math.floor(timeDifference / (1000 * 60 * 60))).padStart(2, '0');
            const minutes = String(Math.floor((timeDifference % (1000 * 60 * 60)) / (1000 * 60))).padStart(2, '0');
            const seconds = String(Math.floor((timeDifference % (1000 * 60)) / 1000)).padStart(2, '0');
            action.setTitle(`\n\n\n${hours}:${minutes}:${seconds}`);
        } else {
            action.setTitle(`\n\n\nRestock`);
        }
    }

    private async startUpdating(action: any, settings: TraderSettings): Promise<void> {
        this.stopUpdating(); // Ensure any previous intervals are cleared

        if (settings.pve_traders_mode_check && (!Array.isArray(data_PVE) || data_PVE.length === 0)) {
            await refreshDataPVE();
        } else if (!settings.pve_traders_mode_check && (!Array.isArray(data_PVP) || data_PVP.length === 0)) {
            await refreshDataPVP();
        }

        // Start the interval to update the trader's restock timer
        this.updateInterval = setInterval(() => {
            const trader = settings.selectedTrader;
            const pveMode = settings.pve_traders_mode_check;

            if (!trader) {
                action.setTitle("No\nTrader");
                return;
            }

            const traderData = pveMode ? data_PVE : data_PVP;

            if (!Array.isArray(traderData)) {
                action.setTitle("\n\n\nNo Data");
                return;
            }

            const restockData = traderData.find(data => data.name === trader);

            if (!restockData) {
                action.setTitle("\n\n\nNo Data");
                return;
            }

            this.updateTitleAndImage(action, restockData);
        }, 1000);
    }

    private stopUpdating(): void {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    override onWillAppear(ev: WillAppearEvent<TraderSettings>): void {
        const settings = ev.payload.settings;

        ev.action.setTitle(`\n\n\nLoading`);

        if (!settings.selectedTrader) {
            ev.action.setTitle("Select\nTrader");
            return;
        }

        ev.action.setImage(`assets/${settings.selectedTrader}.png`);
        this.startUpdating(ev.action, settings);
    }

    override onWillDisappear(ev: WillDisappearEvent): void {
        this.stopUpdating();
    }

    override onDidReceiveSettings(ev: DidReceiveSettingsEvent<TraderSettings>): void {
        const settings = ev.payload.settings;

        ev.action.setTitle(`\n\n\nLoading`);

        // Stop any existing updates before changing trader
        this.stopUpdating();

        if (!settings.selectedTrader) {
            ev.action.setTitle("Select\nTrader");
            ev.action.setImage(``);
            return;
        }

        ev.action.setImage(`assets/${settings.selectedTrader}.png`);
        this.startUpdating(ev.action, settings); // Start updating for the new trader
    }
}
