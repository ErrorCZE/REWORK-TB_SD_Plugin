import streamDeck, { LogLevel } from "@elgato/streamdeck";

import { TarkovTime } from "./actions/tarkov-time";
import { TarkovGoonsLocation } from "./actions/goons-location";
import { TarkovTraderRestock } from "./actions/trader-restock";
import { TarkovCurrentMapInfo } from "./actions/current-map-info";
import { TarkovCurrentMapInfo_Name } from "./actions/current-map-name";
import { TarkovCurrentMapInfo_Duration } from "./actions/current-map-duration";



streamDeck.logger.setLevel(LogLevel.TRACE);


streamDeck.actions.registerAction(new TarkovTime());
streamDeck.actions.registerAction(new TarkovGoonsLocation());
streamDeck.actions.registerAction(new TarkovTraderRestock());
streamDeck.actions.registerAction(new TarkovCurrentMapInfo());
streamDeck.actions.registerAction(new TarkovCurrentMapInfo_Name());
streamDeck.actions.registerAction(new TarkovCurrentMapInfo_Duration());


streamDeck.connect();
