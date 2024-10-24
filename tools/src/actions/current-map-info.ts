import { action, KeyDownEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";



const apiURL = "https://tarkovbot.eu/api/bosses";
//! Backend - Add PVE api endpoint

@action({ UUID: "eu.tarkovbot.tools.mapinfo" })
export class TarkovCurrentMapInfo extends SingletonAction {

    override onWillAppear(ev: WillAppearEvent): void | Promise<void> {
        ev.action.setTitle(`Waiting\nFor\nMap`);
    };

    override async onKeyDown(ev: KeyDownEvent): Promise<void> {
        
    }

}

