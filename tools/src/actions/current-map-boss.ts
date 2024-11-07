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
                        ev.action.setTitle(`${bossNameFormatted}\n${boss.spawnChance}`);
                    } else if (bossNameWords.length === 2) {
                        ev.action.setTitle(`${bossNameFormatted}\n${boss.spawnChance}`);
                    } else {
                        ev.action.setTitle(`${bossNameFormatted}\n${boss.spawnChance}`);
                    }

                    const imageUrl = `https://tarkovbot.eu/streamdeck/img/${boss.id}.webp`;
                    const fallbackUrl = `https://tarkovbot.eu/streamdeck/img/unknown_boss.webp`;

                    const base64Image = await this.fetchBase64Image(imageUrl, fallbackUrl);
                    if (base64Image) {
                        ev.action.setImage(base64Image);
                    }
                }
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
            streamDeck.logger.info("Failed to fetch and convert image to Base64:", error);
            return null;
        }
    }


}
