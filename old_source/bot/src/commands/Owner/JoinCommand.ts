import { Command } from "discord-akairo";
import { Message, GuildMember, User } from "discord.js";
import { Repository } from "typeorm";
import { RestoreUser } from "../../models/User";

import { REDIRECT_URI } from "../../Config";

export default class JoinCommand extends Command {
    public constructor() {
        super("join", {
            aliases: ["join"],
            category: "Owner",
            description: {
                content: "Check the latency between the server and the Discord API",
                usage: "join",
                examples: [
                    "join"
                ]
            },
            clientPermissions: ["CREATE_INSTANT_INVITE", "MANAGE_ROLES"],
            userPermissions: ["ADMINISTRATOR"]
        }); 
    }

    public async exec(message: Message): Promise<Message> {
        if (!this.client.settings.get(message.guild, "config.verifiedRole", null)) return message.util.send(`You have not configured a verified role via our dashboard:\n\n${REDIRECT_URI}`);

        const repo: Repository<RestoreUser> = this.client.db.getRepository(RestoreUser);
        const data: RestoreUser = await repo.findOne({ user: message.guild.ownerID });

        if (!data || !JSON.parse(data.tiedUsers).length) return message.util.send("You do not have any users authorized to pull.");

        if (
            this.client.oauth.global.on || 
            (this.client.oauth.ratelimits.get(message.guild.id) ?? {}).blocked
        ) {
            return message.util.send("This bot is being rate limited; try again in a moment.");
        }

        const users: string[] = JSON.parse(data.tiedUsers);

        message.util.send(`Found **${users.length}**! Give me a moment while I add them...`)

        let success: number = 0;
        const failed = [];

        await Promise.all(users.map(async u => {
            let member: GuildMember | User = await message.guild.members.fetch(u).catch(() => null);

            if (member) {
                return failed.push({ name: (member as GuildMember).user.tag, reason: "Already In Guild" });
            }

            const passed: boolean = await this.client.oauth.joinGuild(message.guild.id, u);
            if (passed) {
                success++
            } else {
                if (!member) {
                    member = await this.client.users.fetch(u);
                }

                return failed.push({ name: (member as User).tag, reason: "Ratelimited / Request Failed" })
            };
        }));

        const after = failed.slice(10);

        return message.util.send(
            failed.length ?
                [
                    ...(success > 0 ? [`I could add **${success}/${users.length}**.\n\n`] : [""]),
                    `I could not add ${failed.length} user${failed.length > 1 ? "s" : ""} to the server:`,
                    this.buildProlog(
                        failed.slice(0, 10).map((v) => ({ name: v.name, value: v.reason })),
                        after.length ? `... and ${after.length} more` : ""
                    )
                ] :
                `Successfully pulled **${success}/${users.length}** users into the server.`
        );
    }

    private buildProlog(lines: Line[], bottom: string) {

        const padding = () => {
            let padding = 0;
            for (const line of lines) {
                if (line.name.length > padding) {
                    padding = line.name.length;
                }
            }
            return padding;
        }

        let str = `\`\`\`prolog\n`;

        for (const line of lines) {
            if (line.name.length && line.value.length) {
                str += `${line.name.padStart(padding(), ' ')} : ${line.value}\n`
            }
        }

        if (bottom.length) {
            str += `\n\n${bottom}`
        }

        return (str += `\`\`\``);
    }
}

interface Line {
    name: string;
    value: string;
}
