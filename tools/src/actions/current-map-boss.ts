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

    override async onWillAppear(ev: WillAppearEvent): Promise<void> {
        const locationId = globalThis.location;
        ev.action.setTitle("");
        if (locationId) {
            const mapData = globalThis.locationsDataPVE?.find(map => map.nameId === locationId);
            if (mapData) {
                const boss = mapData.bosses[this.bossIndex];
                if (boss) {
                    const bossNameWords = boss.name.split(" ");
                    const bossNameFormatted = bossNameWords.join("\n");

                    if (bossNameWords.length === 1) {
                        ev.action.setTitle(`\n${bossNameFormatted}\n\n${boss.spawnChance*100}%`);
                    } else if (bossNameWords.length === 2) {
                        ev.action.setTitle(`${bossNameFormatted}\n\n${boss.spawnChance*100}%`);
                    } else {
                        ev.action.setTitle(`${bossNameFormatted}\n${boss.spawnChance*100}%`);
                    }

                    const imageUrl = `https://tarkovbot.eu/streamdeck/img/${boss.id}.webp`;
                    const fallbackUrl = `https://tarkovbot.eu/streamdeck/img/unknown_boss.webp`;

                    const base64Image = await this.fetchBase64Image(imageUrl, fallbackUrl);
                    if (base64Image) {
                        ev.action.setImage(base64Image);
                    }
                }
            } else {
                ev.action.setTitle("\nNo Map\nData");
            }
        }
    }

    private async fetchBase64Image(url: string, fallbackUrl: string): Promise<string | null> {
        try {
            let response = await fetch(url);

            if (!response.ok && fallbackUrl) {
                response = await fetch(fallbackUrl);
            }

            const arrayBuffer = await response.arrayBuffer();
            const base64String = Buffer.from(arrayBuffer).toString('base64');
            return `data:image/webp;base64,${base64String}`;
        } catch (error) {
            console.error("Failed to fetch and convert image to Base64:", error);
            return null;
        }
    }


}
