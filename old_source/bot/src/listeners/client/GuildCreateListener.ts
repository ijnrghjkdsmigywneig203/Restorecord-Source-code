import { Listener } from "discord-akairo";
import { Guild, MessageEmbed, TextChannel } from "discord.js";
import { REDIRECT_URI, LOGS_CHANNEL } from "../../Config";

export default class GuildCreateListener extends Listener {
    public constructor() {
        super("guildCreate", {
            emitter: "client",
            event: "guildCreate",
            category: "client"
        });
    }

    public exec(guild: Guild): any {
        if (!guild.owner.user.premium && this.client.guilds.cache.filter(g => g.ownerID === guild.ownerID).size > 1) {
            guild.owner.send(new MessageEmbed()
                .setAuthor("Sorry about this...", this.client.user.displayAvatarURL())
                .setDescription(`Hello ${guild.owner}, sadly as you are not a premium user, you are only eligible to use this bot in **1** server.`)
                .setColor("#f44336")
            );

            return guild.leave();
        }

        guild.owner.send(new MessageEmbed()
            .setAuthor("Thanks for adding me!", this.client.user.displayAvatarURL())
            .setDescription(`Hello ${guild.owner}, thank you for adding me to **${guild.name}** - you can get the most of our features via our web dashboard!`)
            .addField("Dashboard URL:", `[Click Me](${REDIRECT_URI})`)
            .setColor("#4caf50")
        );

        const adminLog: TextChannel = this.client.channels.cache.get(LOGS_CHANNEL) as TextChannel;
        if (adminLog) adminLog.send(new MessageEmbed()
            .setAuthor(`${guild.name} | Added Bot`, guild.iconURL())
            .setDescription(`${this.client.user.username} has been added to ${guild.name} which is now **${this.client.guilds.cache.size}** servers!`)
            .addField("Server Owner:", guild.owner.user.tag)
            .setColor("#4caf50")
        ).catch(() => console.error());
    }
}