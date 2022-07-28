import { ActivityType, PresenceStatusData } from "discord.js";

// Basic bot details
export const TOKEN: string = "";
export const OWNERS: Array<string> = ["700605328579887164", "717629560346116199"]; // Xora, vittiwolf
export const PREFIX: string = "%";

// Presence details
export const PRESENCE_STATUS: PresenceStatusData = "dnd";
export const PRESENCE_ACTIVITY_TYPE: ActivityType = "COMPETING";
export const PRESENCE_ACTIVITY_TEXT: string = "fortnite duos";

// OAuth2 details
export const API_PORT: number = 80;
export const API_IP: string = "";
export const CLIENT_SECRET: string = "";
export const REDIRECT_URI: string = "";
export const CALLBACK_URI: string = "";
export const SCOPES: string = "identify guilds guilds.join";

// Misc details
export const DATABASE_NAME: string = "bot";
export const LOGS_CHANNEL: string = "";