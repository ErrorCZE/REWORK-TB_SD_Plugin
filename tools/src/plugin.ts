import streamDeck, { LogLevel } from "@elgato/streamdeck";

import { TarkovTime } from "./actions/tarkov-time";
import { TarkovGoonsLocation } from "./actions/goons-location";
import { TarkovTraderRestock } from "./actions/trader-restock";


streamDeck.logger.setLevel(LogLevel.TRACE);


streamDeck.actions.registerAction(new TarkovTime());
streamDeck.actions.registerAction(new TarkovGoonsLocation());
streamDeck.actions.registerAction(new TarkovTraderRestock());


streamDeck.connect();
