import {
    streamDeck,
    action,
    SingletonAction,
    WillAppearEvent
} from "@elgato/streamdeck";

// Base class for Boss Info
export class TarkovCurrentMapInfo_Boss extends SingletonAction {
    private bossIndex: number;

    constructor(bossIndex: number) {
        super();
        this.bossIndex = bossIndex;
    }

    override onWillAppear(ev: WillAppearEvent): void | Promise<void> {
        const locationId = globalThis.location;
        if (locationId) {
            const mapData = globalThis.locationsDataPVE?.find(map => map.nameId === locationId);
            if (mapData) {
                const boss = mapData.bosses[this.bossIndex]; // Use the boss index
                if (boss) {
                    const bossNameWords = boss.name.split(" ");
                    const bossNameFormatted = bossNameWords.join("\n");

                    if (bossNameWords.length === 1) {
                        ev.action.setTitle(`\n${bossNameFormatted}\n\n${boss.spawnChance}%`);
                    } else if (bossNameWords.length === 2) {
                        ev.action.setTitle(`${bossNameFormatted}\n\n${boss.spawnChance}%`);
                    } else {
                        ev.action.setTitle(`${bossNameFormatted}\n${boss.spawnChance}%`);
                    }
                }
            } else {
                ev.action.setTitle("\nNo Map\nData");
            }
        } else {
            ev.action.setTitle("\nUnknown\nLocation");
        }
    }
}
