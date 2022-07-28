import { Listener } from "discord-akairo";
import { Guild, MessageEmbed, TextChannel } from "discord.js";
import { LOGS_CHANNEL } from "../../Config";

export default class GuildDeleteListener extends Listener {
    public constructor() {
        super("guildDelete", {
            emitter: "client",
            event: "guildDelete",
            category: "client"
        });
    }

    public exec(guild: Guild): any {
        const adminLog: TextChannel = this.client.channels.cache.get(LOGS_CHANNEL) as TextChannel;
        if (adminLog) adminLog.send(new MessageEmbed()
            .setAuthor(`${guild.name} | Removed Bot`, guild.iconURL())
            .setDescription(`${this.client.user.username} has been removed from ${guild.name} which is now **${this.client.guilds.cache.size}** servers!`)
            .addField("Server Owner:", guild.owner.user.tag)
            .setColor("#f44336")
        ).catch(() => console.error());
    }
}