import streamDeck, { LogLevel } from "@elgato/streamdeck";

import { TarkovTime } from "./actions/tarkov-time";
import { TarkovGoonsLocation } from "./actions/goons-location";
import { TarkovTraderRestock } from "./actions/trader-restock";
import { TarkovCurrentMapInfo } from "./actions/current-map-info";


streamDeck.logger.setLevel(LogLevel.TRACE);


streamDeck.actions.registerAction(new TarkovTime());
streamDeck.actions.registerAction(new TarkovGoonsLocation());
streamDeck.actions.registerAction(new TarkovTraderRestock());
streamDeck.actions.registerAction(new TarkovCurrentMapInfo());


streamDeck.connect();
