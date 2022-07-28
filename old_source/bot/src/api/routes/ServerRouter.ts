import { Application, Router, Request, Response } from "express";
import { Guild, Role, CategoryChannel, TextChannel, MessageEmbed } from "discord.js";
import { AkairoClient } from "discord-akairo";
import OAuth2 from "../../structures/OAuth2";
import { Repository } from "typeorm";
import { RestoreUser } from "../../models/User";

import { LOGS_CHANNEL, OWNERS, PREFIX } from "../../Config";
import { User } from "discord.js";

export default class AdminRouter {
    protected app: Application;
    protected client: AkairoClient;
    protected router: Router;
    protected oauth: OAuth2; 
    protected userRepo: Repository<RestoreUser>;

    public constructor(app: Application, client: AkairoClient, oauth: OAuth2) {
        this.app = app;
        this.client = client;
        this.router = Router();
        this.oauth = oauth;
        this.userRepo = this.client.db.getRepository(RestoreUser);

        this.app.use(this.router);

        this.app.get("/restore/:id/pull", async (req: Request, res: Response) => {
            const user = await this.oauth.user(req.cookies.access_token, req.cookies.refresh_token, res);
            if (!user) return res.status(401).json({
                error: true,
                response: "You are not logged in with discord."
            });

            const guild: Guild = this.client.guilds.cache.get(req.params.id);
            if (!guild) return res.status(404).json({
                error: true,
                response: `${this.client.user.username} is not in this server.`
            });

            const allowAdmin: boolean = this.client.settings.get(guild, "allowAdmin", true);

            if (!OWNERS.includes(user.id)) {
                if (
                    allowAdmin ? 
                        guild.members.cache.has(user.id) ? 
                            !guild.members.cache.get(user.id).permissions.has("ADMINISTRATOR") : true 
                        : guild.ownerID !== user.id) return res.status(401).json({
                    error: true,
                    response: "You do not have permission to manage this server."
                });
            }

            if (!guild.me.permissions.has(["MANAGE_ROLES", "CREATE_INSTANT_INVITE"])) return res.status(400).json({
                error: true,
                response: "I do not have permissions to manage roles and create instant invite."
            });

            const data: RestoreUser = await this.userRepo.findOne({ user: guild.ownerID });
            if (!data || !JSON.parse(data.tiedUsers).length) return res.status(400).json({
                error: true,
                response: "There are no users to pull."
            });

            if (this.client.oauth.global.on || (this.client.oauth.ratelimits.get(guild.id) ?? {}).blocked)
                return res.status(429).json({
                    error: true,
                    response: "This bot is being rate limited; try again in a moment."
                });

            const users: string[] = JSON.parse(data.tiedUsers);
            let success: number = 0;
            await Promise.all(users.map(async u => {
                const passed: boolean = await this.oauth.joinGuild(guild.id, u);
                if (passed) success++;
            }));

            return res.status(200).json({
                error: false,
                response: success
            });
        });

        this.app.get("/restore/:guild/pull/:user", async (req: Request, res: Response) => {
            const user = await this.oauth.user(req.cookies.access_token, req.cookies.refresh_token, res);
            if (!user) return res.status(401).json({
                error: true,
                response: "You are not logged in with discord."
            });

            const guild: Guild = this.client.guilds.cache.get(req.params.guild);
            if (!guild) return res.status(404).json({
                error: true,
                response: `${this.client.user.username} is not in this server.`
            });

            const allowAdmin: boolean = this.client.settings.get(guild, "allowAdmin", true);

            if (!OWNERS.includes(user.id)) {
                if (
                    allowAdmin ? 
                        guild.members.cache.has(user.id) ? 
                            !guild.members.cache.get(user.id).permissions.has("ADMINISTRATOR") : true 
                        : guild.ownerID !== user.id) return res.status(401).json({
                    error: true,
                    response: "You do not have permission to manage this server."
                });
            }

            if (!guild.me.permissions.has(["MANAGE_ROLES", "CREATE_INSTANT_INVITE"])) return res.status(400).json({
                error: true,
                response: "I do not have permissions to manage roles and create instant invite."
            });

            const data: RestoreUser = await this.userRepo.findOne({ user: guild.ownerID });
            if (!JSON.parse(data.tiedUsers).includes(req.params.user)) return res.status(400).json({
                error: true,
                response: "This user is not linked to the server owner."
            });

            if (this.client.oauth.global.on || (this.client.oauth.ratelimits.get(guild.id) ?? {}).blocked)
                return res.status(429).json({
                    error: true,
                    response: "This bot is being rate limited; try again in a moment."
                });

            const passed: boolean = await this.oauth.joinGuild(guild.id, req.params.user);

            if (!passed) return res.status(401).json({
                error: true,
                response: "This user has not authorized with restore bot."
            });

            return res.status(200).json({
                error: false,
                response: passed
            });
        });

        this.app.get("/:id/load", async (req: Request, res: Response) => {
            const user = await this.oauth.user(req.cookies.access_token, req.cookies.refresh_token, res);
            if (!user) return res.status(401).json({
                error: true,
                response: "You are not logged in with discord."
            });

            const guild: Guild = this.client.guilds.cache.get(req.params.id);
            if (!guild) return res.status(404).json({
                error: true,
                response: `${this.client.user.username} is not in this server.`
            });

            const allowAdmin: boolean = this.client.settings.get(guild, "allowAdmin", true);

            if (!OWNERS.includes(user.id)) {
                if (
                    allowAdmin ? 
                        guild.members.cache.has(user.id) ? 
                            !guild.members.cache.get(user.id).permissions.has("ADMINISTRATOR") : true 
                        : guild.ownerID !== user.id) return res.status(401).json({
                    error: true,
                    response: "You do not have permission to manage this server."
                });
            }

            const data: RestoreUser = await this.userRepo.findOne({ user: guild.ownerID });
            const linkedUsers = data ? await Promise.all(JSON.parse(data.tiedUsers).map(async e => {
                const u: User = await this.client.users.fetch(e).catch(() => null);
                if (u) return {
                    id: u.id,
                    tag: u.tag,
                    inServer: guild.members.cache.has(u.id)
                }
            })) : [];

            return res.status(200).json({
                error: false,
                response: {
                    id: guild.id,
                    name: guild.name,
                    icon: guild.iconURL({ format: "png" }),
                    roles: guild.roles.cache.filter(r => r.id !== guild.id).map(r => r),
                    channels: guild.channels.cache.filter(c => c.type === "text").map(c => c),
                    prefix: this.client.settings.get(guild, "config.prefix", PREFIX),
                    verifiedRole: this.client.settings.get(guild, "config.verifiedRole", null),
                    logsChannel: this.client.settings.get(guild, "config.logsChannel", null),
                    welcomeMessage: this.client.settings.get(guild, "config.welcomeMessage", `Welcome to {servername}`),
                    memberCount: guild.memberCount,
                    allowAdmin,
                    owner: guild.ownerID === user.id,
                    linkedUsers
                }
            });
        });

        this.app.post("/:id/manage", async (req: Request, res: Response) => {
            const user = await this.oauth.user(req.cookies.access_token, req.cookies.refresh_token, res);
            if (!user) return res.status(401).json({
                error: true,
                response: "You are not logged in with discord."
            });

            const guild: Guild = this.client.guilds.cache.get(req.params.id);
            if (!guild) return res.status(404).json({
                error: true,
                response: `${this.client.user.username} is not in this server.`
            });

            const allowAdmin: boolean = this.client.settings.get(guild, "allowAdmin", true);

            if (!OWNERS.includes(user.id)) {
                if (
                    allowAdmin ? 
                        guild.members.cache.has(user.id) ? 
                            !guild.members.cache.get(user.id).permissions.has("ADMINISTRATOR") : true 
                        : guild.ownerID !== user.id) return res.status(401).json({
                    error: true,
                    response: "You do not have permission to manage this server."
                });
            }

            if (!req.body.prefix || req.body.prefix.length > 15) return res.status(400).json({
                error: true,
                response: "You did not provide a prefix below 16 characters."
            });

            if (!req.body.verifiedRole) return res.status(404).json({
                error: true,
                response: "You did not provide a verified role."
            });

            if (!req.body.logsChannel) return res.status(404).json({
                error: true,
                response: "You did not provide a logs channel."
            });

            if (user.premium) {
                if (!req.body.welcomeMessage || req.body.welcomeMessage.length > 1000) return res.status(404).json({
                    error: true,
                    response: "You did not provide a welcome message below 1000 characters."
                });
            }

            const verifiedRole: Role = guild.roles.cache.get(req.body.verifiedRole);
            if (!verifiedRole || !guild.me.permissions.has("MANAGE_ROLES")) return res.status(400).json({
                error: true,
                response: "You provided an invalid role or I do not have permissions to manage roles."
            });

            const logsChannel: TextChannel = guild.channels.cache.get(req.body.logsChannel) as TextChannel;
            if (!logsChannel || !logsChannel.permissionsFor(guild.me).has(["SEND_MESSAGES", "EMBED_LINKS"])) return res.status(400).json({
                error: true,
                response: "You provided an invalid logs channel or I do not have permissions to post to the channel."
            });

            if (guild.owner.user.premium && this.client.settings.get(guild, "config.welcomeMessage", "Welcome to {servername}") !== req.body.welcomeMessage) {
                this.client.settings.set(guild, "config.welcomeMessage", req.body.welcomeMessage);

                // Admin Logging
                const adminLog: TextChannel = this.client.channels.cache.get(LOGS_CHANNEL) as TextChannel;
                if (adminLog) adminLog.send(new MessageEmbed()
                    .setAuthor(`${guild.name} | Welcome Message Updated`, guild.iconURL())
                    .addField("Edited By:", `${user.username}#${user.discriminator} (${user.id})`)
                    .addField("New Message:", req.body.welcomeMessage)
                    .setColor("#4caf50")
                ).catch(() => console.error());
            }

            this.client.settings.set(guild, "config.prefix", req.body.prefix);
            this.client.settings.set(guild, "config.verifiedRole", req.body.verifiedRole);
            this.client.settings.set(guild, "config.logsChannel", req.body.logsChannel);
            if (guild.ownerID === user.id) this.client.settings.set(guild, "allowAdmin", req.body.allowAdmin ? true : false);

            return res.status(201).send({
                error: false,
                response: req.body
            });
        });

        this.app.post("/:id/backup", async (req: Request, res: Response) => {
            const user = await this.oauth.user(req.cookies.access_token, req.cookies.refresh_token, res);
            if (!user) return res.status(401).json({
                error: true,
                response: "You are not logged in with discord."
            });

            const guild: Guild = this.client.guilds.cache.get(req.params.id);
            if (!guild) return res.status(404).json({
                error: true,
                response: `${this.client.user.username} is not in this server.`
            });

            const allowAdmin: boolean = this.client.settings.get(guild, "allowAdmin", true);

            if (!OWNERS.includes(user.id)) {
                if (
                    allowAdmin ? 
                        guild.members.cache.has(user.id) ? 
                            !guild.members.cache.get(user.id).permissions.has("ADMINISTRATOR") : true 
                        : guild.ownerID !== user.id) return res.status(401).json({
                    error: true,
                    response: "You do not have permission to manage this server."
                });
            }

            const roles: any[] = guild.roles.cache.filter(role => role.id !== guild.id).sort((a, b) => b.position - a.position).map(role => {
                return {
                name: role.name,
                color: role.hexColor,
                position: role.position,
                rawPosition: role.rawPosition,
                hoisted: role.hoist,
                mentionable: role.mentionable,
                permissions: role.permissions.bitfield
              }
            });

            const channels: any[] = guild.channels.cache.filter(channel => !channel.parentID).sort((a, b) => b.position - a.position).map(channel => {
                return {
                    name: channel.name,
                    type: channel.type,
                    position: channel.position,
                    rawPosition: channel.rawPosition,
                    children: channel.type === "category" ? (channel as CategoryChannel).children.sort((a, b) => b.position - a.position).map(child => {
                        return {
                            name: child.name,
                            type: child.type,
                            position: child.position,
                            rawPosition: child.rawPosition
                        }
                    }) : null
                }
            });

            this.client.settings.set(guild, "backup", {
                roles,
                channels
            });

            return res.status(201).send({
                error: false,
                response: {
                    roles,
                    channels
                }
            });
        });

        this.app.post("/:id/backup-restore", async (req: Request, res: Response) => {
            const user = await this.oauth.user(req.cookies.access_token, req.cookies.refresh_token, res);
            if (!user) return res.status(401).json({
                error: true,
                response: "You are not logged in with discord."
            });

            const guild: Guild = this.client.guilds.cache.get(req.params.id);
            if (!guild) return res.status(404).json({
                error: true,
                response: `${this.client.user.username} is not in this server.`
            });

            const allowAdmin: boolean = this.client.settings.get(guild, "allowAdmin", true);

            if (!OWNERS.includes(user.id)) {
                if (
                    allowAdmin ? 
                        guild.members.cache.has(user.id) ? 
                            !guild.members.cache.get(user.id).permissions.has("ADMINISTRATOR") : true 
                        : guild.ownerID !== user.id) return res.status(401).json({
                    error: true,
                    response: "You do not have permission to manage this server."
                });
            }

            if (!guild.me.permissions.has(["MANAGE_ROLES", "MANAGE_CHANNELS"])) return res.status(400).json({
                error: true,
                response: "I do not have permissions to manage roles and manage channels."
            });

            const backup: any = this.client.settings.get(guild, "backup", null);
            if (!backup) return res.status(400).json({
                error: true,
                response: "There is no backup for this server."
            });

            await Promise.all(guild.roles.cache.filter(role => role.editable).map(async role => await role.delete("backup restore").catch(() => console.error())));
            await Promise.all(guild.channels.cache.filter(channel => channel.deletable).map(async channel => await channel.delete("backup restore").catch(() => console.error())));

            // Role restore
            await Promise.all(backup.roles.map(async role => {
                await guild.roles.create({
                    data: {
                        name: role.name,
                        color: role.color,
                        hoist: role.hoisted,
                        mentionable: role.mentionable,
                        permissions: role.permissions
                    }
                }).catch(() => console.error());
            }));

            // Channel restore
            await Promise.all(backup.channels.sort((a, b) => a.position > b.position ? 1 : b.position > a.position ? -1 : 0).map(async channel => {
                if (channel.type === "category") {
                    const cat: CategoryChannel | void = await guild.channels.create(channel.name, {
                        type: "category"
                    }).catch(() => console.error());

                    await Promise.all(channel.children.sort((a, b) => a.position > b.position ? 1 : b.position > a.position ? -1 : 0).map(async child => {
                        await guild.channels.create(child.name, {
                            type: child.type,
                            parent: (cat as CategoryChannel).id
                        }).catch(() => console.error());
                    }));
                } else {
                    await guild.channels.create(channel.name, {
                        type: channel.type
                    }).catch(() => console.error());
                }
            }));

            return res.status(201).send({
                error: false,
                response: true
            });
        });
    }
}