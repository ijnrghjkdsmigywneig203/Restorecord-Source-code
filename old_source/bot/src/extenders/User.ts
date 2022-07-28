import { Structures } from "discord.js";
import { AkairoClient } from "discord-akairo";
import { OWNERS } from "../Config";

declare module "discord.js" {
    interface User {
        premium: boolean;
    }
}

export default Structures.extend("User", User => class extends User {
    get premium() {
        return (this.client as AkairoClient).settings.get("global", "premiumUsers", []).includes(this.id) || OWNERS.includes(this.id);
    }
});