import { action, KeyDownEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";

@action({ UUID: "eu.tarkovbot.tools.tarkovtime" })
export class TarkovTime extends SingletonAction {

    private updateInterval: NodeJS.Timeout | undefined;

    override onWillAppear(ev: WillAppearEvent): void | Promise<void> {
        const updateTarkovTime = () => {
            const currentDateTime = new Date();
            const multiplier = 7;

            const tarkovTimeLeft = new Date(currentDateTime.getTime() * multiplier).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
                timeZone: 'Europe/Moscow'
            });
            const tarkovTimeRight = new Date(currentDateTime.getTime() * multiplier - 43200000).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
                timeZone: 'Europe/Moscow'
            });

            ev.action.setTitle(`${tarkovTimeLeft}\n${tarkovTimeRight}`);
        };

        this.updateInterval = setInterval(updateTarkovTime, 2000);

        updateTarkovTime();
    }
}
