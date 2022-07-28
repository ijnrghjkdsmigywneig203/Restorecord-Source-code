import { Listener } from "discord-akairo";
import { MessageEmbed } from "discord.js";

import RestAPI from "../../api/RestAPI";
import { PRESENCE_ACTIVITY_TEXT, PRESENCE_ACTIVITY_TYPE, PRESENCE_STATUS } from "../../Config";

export default class ReadyListener extends Listener {
    public constructor() {
        super("ready", {
            emitter: "client",
            event: "ready",
            category: "client"
        });
    }

    public exec(): void {
        this.client.logger.init(`Logged in as ${this.client.user.tag}`);

        this.client.user.setStatus(PRESENCE_STATUS);
        this.client.user.setActivity(PRESENCE_ACTIVITY_TEXT, {
            type: PRESENCE_ACTIVITY_TYPE
        });

        new RestAPI(this.client).start();

        // Premium Checker
        setInterval(() => {
            this.checkPremium();
        }, 3e5);
        this.checkPremium();
    }
    
    private checkPremium() {
        const toLeave = new Set();

        const freeGuilds = this.client.guilds.cache.filter(g => !g.owner.user.premium);
        freeGuilds.map(g => {
            const guildCheck = this.client.guilds.cache.filter(guild => guild.ownerID === g.ownerID);

            if (guildCheck.size > 1) {
                toLeave.add(g.ownerID);
            }
        });

        [...toLeave].map((m: string) => {
            this.client.users.cache.get(m).send(new MessageEmbed()
                .setAuthor("Sorry about this...", this.client.user.displayAvatarURL())
                .setDescription(`Hello, sadly as you are not a premium user, you are only eligible to use this bot in **1** server, I have now left all your servers - please choose one.`)
                .setColor("#f44336")
            ).catch(() => this.client.logger.error("User has disabled their DMs."));

            this.client.guilds.cache.filter(g => g.ownerID === m).map(g => g.leave());
        });
    }
}