import { AkairoClient, CommandHandler, ListenerHandler } from "discord-akairo";
import { Message } from "discord.js";
import { join } from "path";
import { Connection } from "typeorm";

import { PREFIX, DATABASE_NAME } from "../Config";
import Database from "../structures/Database";
import SettingsProvider from "../structures/SettingsProvider";
import { Settings } from "../models/Settings";
import OAuth2 from "../structures/OAuth2";
import Logger from "../structures/Logger";

declare module "discord-akairo" {
    interface AkairoClient {
        commandHandler: CommandHandler;
        listenerHandler: ListenerHandler;
        db: Connection;
        settings: SettingsProvider;
        oauth: OAuth2;
        logger: Logger;
    }
}

interface BotOptions {
    token?: string;
    owners?: Array<string>;
}

export default class BotClient extends AkairoClient {
    public config: BotOptions;
    public db: Connection;
    public settings: SettingsProvider;
    public oauth: OAuth2;
    public logger: Logger;

    public constructor(config: BotOptions) {
        super({
            ownerID: config.owners,
            disableMentions: "everyone"
        });

        this.config = config;
    }

    public listenerHandler: ListenerHandler = new ListenerHandler(this, {
        directory: join(__dirname, "..", "listeners")
    });

    public commandHandler: CommandHandler = new CommandHandler(this, {
        directory: join(__dirname, "..", "commands"),
        prefix: (msg: Message) => this.settings.get(msg.guild, "config.prefix", PREFIX),
        allowMention: true,
        handleEdits: true,
        commandUtil: true,
        fetchMembers: true,
        defaultCooldown: 6e4
    });

    private async init(): Promise<void> {
        this.commandHandler.useListenerHandler(this.listenerHandler);
        this.listenerHandler.setEmitters({
            commandHandler: this.commandHandler,
            listenerHandler: this.listenerHandler,
            process
        });

        this.commandHandler.loadAll();
        this.listenerHandler.loadAll();

        this.db = Database.get(DATABASE_NAME);
        await this.db.connect();
        await this.db.synchronize();

        this.settings = new SettingsProvider(this.db.getRepository(Settings));
        await this.settings.init();

        this.logger = new Logger();
    }

    public async start(): Promise<string> {
        await this.init();
        return this.login(this.config.token);
    }
}