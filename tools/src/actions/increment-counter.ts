import { action, KeyDownEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";


@action({ UUID: "eu.tarkovbot.tools.increment" })
export class IncrementCounter extends SingletonAction<CounterSettings> {

	override onWillAppear(ev: WillAppearEvent<CounterSettings>): void | Promise<void> {
		return ev.action.setTitle(`${ev.payload.settings.count ?? 0}`);
	}


	override async onKeyDown(ev: KeyDownEvent<CounterSettings>): Promise<void> {
		const { settings } = ev.payload;
		settings.incrementBy ??= 1;
		settings.count = (settings.count ?? 0) + settings.incrementBy;

		await ev.action.setSettings(settings);
		await ev.action.setTitle(`${settings.count}`);
	}
}

type CounterSettings = {
	count?: number;
	incrementBy?: number;
};
