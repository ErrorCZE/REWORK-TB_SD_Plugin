import { action, KeyDownEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";

const apiURL = "https://tarkovbot.eu/api/streamdeck/goonslocation";


interface GoonsData {
    location: string;
    reported: string;
    pvp: {
        location: string;
        reported: string;
    }
    pve: {
        location: string;
        reported: string;
    }
}

@action({ UUID: "eu.tarkovbot.tools.goonsgetlocation" })
export class TarkovGoonsLocation extends SingletonAction {

    override onWillAppear(ev: WillAppearEvent): void | Promise<void> {
        ev.action.setTitle(`Press to\nGet\nLocation`);
    };

    override async onKeyDown(ev: KeyDownEvent): Promise<void> {
        const { selectedGoonsSource, token } = ev.payload.settings;

        if (!token) {
            ev.action.setTitle("Enter\nYour\nToken");
            return;
        }

        if (!selectedGoonsSource) {
            ev.action.setTitle("Select\nSource");
            return;
        }
    
        try {

            const response = await fetch(apiURL, {
                method: "GET",
                headers: {
                    "AUTH-TOKEN": String(token)
                }
            });

            if(response.status === 401) {
                ev.action.setTitle("Invalid\nToken");
                return;
            }

            if(response.status !== 200) {
                ev.action.setTitle("Something\nwent\nwrong.");
                return;
            }

            const goonsData = await response.json() as GoonsData;
            let location = selectedGoonsSource === "NEW" ? goonsData.location : (selectedGoonsSource === "PVP" ? goonsData.pvp.location : goonsData.pve.location);
            let reported = selectedGoonsSource === "NEW" ? goonsData.reported : (selectedGoonsSource === "PVP" ? goonsData.pvp.reported : goonsData.pve.reported);

            ev.action.setTitle(`${location}\n${reported}`);

        } catch (error) {
            ev.action.setTitle(`Something\nwent\nwrong.`);
        }
    }
    
}

