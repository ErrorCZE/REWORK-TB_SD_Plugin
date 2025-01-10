import streamDeck, { LogLevel } from "@elgato/streamdeck";

import { TarkovTime } from "./actions/tarkov-time";
import { TarkovGoonsLocation } from "./actions/goons-location";
import { TarkovTraderRestock } from "./actions/trader-restock";
import { TarkovCurrentMapInfo } from "./actions/current-map-info";
import { TarkovCurrentMapInfo_Name } from "./actions/current-map-name";
import { TarkovCurrentMapInfo_Duration } from "./actions/current-map-duration";
import { TarkovCurrentMapInfo_Players } from "./actions/current-map-players";
import { TarkovCurrentMapInfo_BackToProfile } from "./actions/current-map-backtoprofile";

import { 
    TarkovCurrentMapInfo_Boss_First,
    TarkovCurrentMapInfo_Boss_Second,
    TarkovCurrentMapInfo_Boss_Third,
    TarkovCurrentMapInfo_Boss_Fourth,
    TarkovCurrentMapInfo_Boss_Fifth,
    TarkovCurrentMapInfo_Boss_Sixth,
    TarkovCurrentMapInfo_Boss_Seventh,
    TarkovCurrentMapInfo_Boss_Eighth,
    TarkovCurrentMapInfo_Boss_Ninth,
    TarkovCurrentMapInfo_Boss_Tenth,
    TarkovCurrentMapInfo_Boss_Eleventh,
    TarkovCurrentMapInfo_Boss_Twelfth,
    TarkovCurrentMapInfo_Boss_Thirteenth,
    TarkovCurrentMapInfo_Boss_Fourteenth,
    TarkovCurrentMapInfo_Boss_Fifteenth,
    TarkovCurrentMapInfo_Boss_Sixteenth
} from "./actions/current-map-bosses";


/* 
streamDeck.logger.setLevel(LogLevel.TRACE);
*/


streamDeck.actions.registerAction(new TarkovTime());
streamDeck.actions.registerAction(new TarkovGoonsLocation());
streamDeck.actions.registerAction(new TarkovTraderRestock());

streamDeck.actions.registerAction(new TarkovCurrentMapInfo());
streamDeck.actions.registerAction(new TarkovCurrentMapInfo_Name());
streamDeck.actions.registerAction(new TarkovCurrentMapInfo_Duration());
streamDeck.actions.registerAction(new TarkovCurrentMapInfo_Players());

streamDeck.actions.registerAction(new TarkovCurrentMapInfo_Boss_First());
streamDeck.actions.registerAction(new TarkovCurrentMapInfo_Boss_Second());
streamDeck.actions.registerAction(new TarkovCurrentMapInfo_Boss_Third());
streamDeck.actions.registerAction(new TarkovCurrentMapInfo_Boss_Fourth());
streamDeck.actions.registerAction(new TarkovCurrentMapInfo_Boss_Fifth());
streamDeck.actions.registerAction(new TarkovCurrentMapInfo_Boss_Sixth());
streamDeck.actions.registerAction(new TarkovCurrentMapInfo_Boss_Seventh());
streamDeck.actions.registerAction(new TarkovCurrentMapInfo_Boss_Eighth());
streamDeck.actions.registerAction(new TarkovCurrentMapInfo_Boss_Ninth());
streamDeck.actions.registerAction(new TarkovCurrentMapInfo_Boss_Tenth());
streamDeck.actions.registerAction(new TarkovCurrentMapInfo_Boss_Eleventh());
streamDeck.actions.registerAction(new TarkovCurrentMapInfo_Boss_Twelfth());
streamDeck.actions.registerAction(new TarkovCurrentMapInfo_Boss_Thirteenth());
streamDeck.actions.registerAction(new TarkovCurrentMapInfo_Boss_Fourteenth());
streamDeck.actions.registerAction(new TarkovCurrentMapInfo_Boss_Fifteenth());
streamDeck.actions.registerAction(new TarkovCurrentMapInfo_Boss_Sixteenth());

streamDeck.actions.registerAction(new TarkovCurrentMapInfo_BackToProfile());

streamDeck.connect();
