import { Listener } from "discord-akairo";
import { GuildMember, MessageEmbed } from "discord.js";
import { Repository } from "typeorm";
import { RestoreUser } from "../../models/User";
import { REDIRECT_URI } from "../../Config";

export default class GuildMemberAddListener extends Listener {
    public constructor() {
        super("guildMemberAdd", {
            emitter: "client",
            event: "guildMemberAdd",
            category: "client"
        });
    }

    public async exec(member: GuildMember): Promise<void> {
        if (this.client.settings.get(member.guild, "config.verifiedRole", null)) {
            const repo: Repository<RestoreUser> = this.client.db.getRepository(RestoreUser);
            const data: RestoreUser = await repo.findOne({ user: member.guild.ownerID });

            const welcomeMessage: string = this.client.settings.get(member.guild, "config.welcomeMessage", "Welcome to {servername}");

            if (data) {
                if (!JSON.parse(data.tiedUsers).includes(member.id)) {
                    member.send(new MessageEmbed()
                        .setAuthor(`Welcome ${member.user.username}`, member.user.displayAvatarURL())
                        .setDescription(welcomeMessage.replace("{servername}", member.guild.name))
                        .addField("Notes:", `You are not yet verified in this server, verify via [this link](${REDIRECT_URI}/${member.guild.ownerID}/register)`)
                        .setColor("#87ceeb")
                    ).catch(() => this.client.logger.error(`${member.user.tag} has disabled DMs.`));
                } else {
                    member.send(new MessageEmbed()
                        .setAuthor(`Welcome ${member.user.username}`, member.user.displayAvatarURL())
                        .setDescription(welcomeMessage.replace("{servername}", member.guild.name))
                        .addField("Notes:", `You are already verified and have most likely been pulled in here by the server owner (${member.guild.owner.user.tag})`)
                        .setColor("#87ceeb")
                    ).catch(() => this.client.logger.error(`${member.user.tag} has disabled DMs.`));  
                }
            } else {
                member.send(new MessageEmbed()
                    .setAuthor(`Welcome ${member.user.username}`, member.user.displayAvatarURL())
                    .setDescription(welcomeMessage.replace("{servername}", member.guild.name))
                    .addField("Notes:", `You are not yet verified in this server, verify via [this link](${REDIRECT_URI}/${member.guild.ownerID}/register)`)
                    .setColor("#87ceeb")
                ).catch(() => this.client.logger.error(`${member.user.tag} has disabled DMs.`));
            }
        }
    }
}