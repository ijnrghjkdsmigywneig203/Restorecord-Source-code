import { Command } from "discord-akairo";
import { Message } from "discord.js";

export default class PingCommand extends Command {
    public constructor() {
        super("ping", {
            aliases: ["ping"],
            category: "Utility",
            description: {
                content: "Check the latency between the server and the Discord API",
                usage: "ping",
                examples: [
                    "ping"
                ]
            }
        }); 
    }

    public exec(message: Message): Promise<Message> {
        return message.util.send(`Pong! 🏓 \`${this.client.ws.ping}ms\``);
    }
}