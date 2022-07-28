import { Command } from "discord-akairo";
import { Message } from "discord.js";

import { REDIRECT_URI } from "../../Config";

export default class HelpCommand extends Command {
    public constructor() {
        super("help", {
            aliases: ["help"],
            category: "Utility",
            description: {
                content: "Check out how to use our bot",
                usage: "help",
                examples: [
                    "help"
                ]
            }
        }); 
    }

    public exec(message: Message): Promise<Message> {
        return message.util.send(`You can configure your server at our web dashboard:\n\n${REDIRECT_URI}`);
    }
}