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
        const pveMode = globalThis.pve_map_mode_check; 
        const locationId = globalThis.location;
        ev.action.setTitle("");
        ev.action.setImage("");
    
        if (locationId) {
            // Select PvE or PvP data based on the pveMode value
            const mapData = pveMode
                ? globalThis.locationsDataPVE?.find(map => map.nameId === locationId)
                : globalThis.locationsDataPVP?.find(map => map.nameId === locationId);
    
            if (mapData) {
                const boss = mapData.bosses[this.bossIndex];
                if (boss) {
                    const bossNameWords = boss.name.split(" ");
                    let bossNameFormatted = bossNameWords.join("\n");

                    if (bossNameFormatted === "Knight") bossNameFormatted = "Goons";
    
                    // Set title with boss name and spawn chance based on word count
                    ev.action.setTitle(`${bossNameFormatted}\n${boss.spawnChance}`);
    
                    // Define image URLs
                    const imageUrl = `https://tarkovbot.eu/streamdeck/img/${boss.id}.webp`;
                    const fallbackUrl = `https://tarkovbot.eu/streamdeck/img/unknown_boss.webp`;
    
                    // Fetch and set the image
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
