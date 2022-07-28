import { Application, Router, Request, Response } from "express";
import { AkairoClient } from "discord-akairo";
import { User, TextChannel, MessageEmbed } from "discord.js";
import OAuth2 from "../../structures/OAuth2";
import { Repository } from "typeorm";
import { RestoreUser } from "../../models/User";
import { LOGS_CHANNEL, OWNERS } from "../../Config";

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

        this.app.get("/restore/:id/load", async (req: Request, res: Response) => {
            const user = await this.oauth.user(req.cookies.access_token, req.cookies.refresh_token, res);
            if (!user) return res.status(401).json({
                error: true,
                response: "You are not logged in with discord."
            });

            const u: User = await this.client.users.fetch(req.params.id).catch(() => null);
            if (!u) return res.status(404).send({
                error: true,
                response: "Provided user does not exist."
            });

            const data: RestoreUser = await this.userRepo.findOne({ user: u.id });

            return res.status(200).json({
                error: false,
                response: {
                    id: u.id,
                    username: u.username,
                    discriminator: u.discriminator,
                    avatar: u.displayAvatarURL({ format: "png" }),
                    redirectUri: data ? data.redirectUri : null,
                    linked: data ? data.tiedUsers.includes(user.id) : false
                }
            });
        });

        this.app.post("/restore/:id/save-data", async (req: Request, res: Response) => {
            const user = await this.oauth.user(req.cookies.access_token, req.cookies.refresh_token, res);
            if (!user || user.id !== req.params.id) return res.status(401).json({
                error: true,
                response: "You are not logged in with discord or you do not own this account."
            });

            if (!user.premium) return res.status(403).json({
                error: true,
                response: "You cannot access premium features."
            });

            const u: User = await this.client.users.fetch(req.params.id).catch(() => null);
            if (!u) return res.status(404).send({
                error: true,
                response: "Provided user does not exist."
            });

            const data: RestoreUser = await this.userRepo.findOne({ user: u.id });

            if (req.body.redirectUri && !/^(http:\/\/www\.|https:\/\/www\.|http:\/\/|https:\/\/)?[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,5}(:[0-9]{1,5})?(\/.*)?$/g.test(req.body.redirectUri)) return res.status(404).json({
                error: true,
                response: "You did not provide a valid redirect URL."
            });

            if (data) {
                data.redirectUri = req.body.redirectUri;
                this.userRepo.save(data);
            } else {
                this.userRepo.insert({
                    user: u.id,
                    redirectUri: req.body.redirectUri
                });
            }

            return res.status(201).json({
                error: false,
                response: req.body
            });
        });

        this.app.get("/restore/:id/migrate", async (req: Request, res: Response) => {
            const user = await this.oauth.user(req.cookies.access_token, req.cookies.refresh_token, res);
            if (!user) return res.status(401).json({
                error: true,
                response: "You are not logged in with discord."
            });

            if (!req.params.id) return res.status(404).json({
                error: true,
                response: "You did not provide an old user ID."
            });

            if (req.params.id === user.id) return res.status(400).json({
                error: true,
                response: "You cannot provide your current user ID as your old user ID."
            });

            const u: User = await this.client.users.fetch(req.params.id).catch(() => null);
            if (!u) return res.status(404).send({
                error: true,
                response: "Provided user does not exist."
            });

            const data: RestoreUser = await this.userRepo.findOne({ user: u.id });
            if (!data) return res.status(400).json({
                error: true,
                response: "Provided user has no restore data."
            });

            const migrations: { oldId: string, newId: string }[] = this.client.settings.get("global", "migrations", []);
            if (migrations.find(e => e.newId === user.id)) return res.status(400).json({
                error: true,
                response: "You already have a migration request pending, please wait."
            });

            migrations.push({
                oldId: u.id,
                newId: user.id
            });

            this.client.settings.set("global", "migrations", migrations);

            return res.status(200).json({
                error: false,
                response: "Migration request sent for approval, please wait."
            });
        });

        this.app.get("/restore/:id/register", async (req: Request, res: Response) => {
            const user = await this.oauth.user(req.cookies.access_token, req.cookies.refresh_token, res);
            if (!user) return res.status(401).json({
                error: true,
                response: "You are not logged in with discord."
            });

            const u: User = await this.client.users.fetch(req.params.id).catch(() => null);
            if (!u) return res.status(404).send({
                error: true,
                response: "Provided user does not exist."
            });

            const data: RestoreUser = await this.userRepo.findOne({ user: u.id });
            if (!data) {
                this.userRepo.insert({
                    user: u.id,
                    tiedUsers: JSON.stringify([user.id])
                });
            } else {
                const tiedUsers: string[] = JSON.parse(data.tiedUsers);
                tiedUsers.push(user.id);

                data.tiedUsers = JSON.stringify([...new Set(tiedUsers)]);
                this.userRepo.save(data);
            }

            // Role assignment
            this.client.guilds.cache.filter(g => 
                g.ownerID === u.id && 
                this.client.settings.get(g, "config.verifiedRole", null) &&
                g.members.cache.has(user.id)).map(g => {
                    g.members.cache.get(user.id)
                        .roles.add(this.client.settings.get(g, "config.verifiedRole", null))
                            .catch(() => this.client.settings.delete(g, "config.verifiedRole"));

                    // Customer Logging
                    const channel: TextChannel = this.client.channels.cache.get(this.client.settings.get(g, "config.logsChannel", null)) as TextChannel;
                    if (channel && channel.permissionsFor(g.me).has(["EMBED_LINKS", "SEND_MESSAGES"])) {
                        channel.send(new MessageEmbed()
                            .setAuthor(`${user.username}#${user.discriminator} | Account Tied`, `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`)
                            .setDescription(`This user has authorized with you to be pulled into any server at anytime!`)
                            .addField("Verified At:", new Date().toLocaleString())
                            .setColor("#4caf50")
                        ).catch(() => console.log("Error on customer logging."));
                    }
                });

            // Admin Logging
            const adminLog: TextChannel = this.client.channels.cache.get(LOGS_CHANNEL) as TextChannel;
            if (adminLog) adminLog.send(new MessageEmbed()
                .setAuthor(`${user.username}#${user.discriminator} | Account Tied`, `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`)
                .setDescription(`This user has authorized ${u.tag} (\`${u.id}\`) to pull them into any server anytime until authorization is revoked.`)
                .addField("Verified At:", new Date().toLocaleString())
                .setColor("#4caf50")
            ).catch(() => console.error());

            return res.status(201).json({
                error: false,
                response: req.body
            });
        }); 

        this.app.get("/restore/:id/unlink", async (req: Request, res: Response) => {
            const user = await this.oauth.user(req.cookies.access_token, req.cookies.refresh_token, res);
            if (!user) return res.status(401).json({
                error: true,
                response: "You are not logged in with discord."
            });

            const u: User = await this.client.users.fetch(req.params.id).catch(() => null);
            if (!u) return res.status(404).send({
                error: true,
                response: "Provided user does not exist."
            });

            const data: RestoreUser = await this.userRepo.findOne({ user: u.id });
            if (!data) return res.status(400).json({
                error: true,
                response: "You are not tied with this user."
            });

            const tiedUsers: string[] = JSON.parse(data.tiedUsers);
            tiedUsers.splice(tiedUsers.indexOf(user.id), 1);

            data.tiedUsers = JSON.stringify([...new Set(tiedUsers)]);
            this.userRepo.save(data);

            // Role assignment
            this.client.guilds.cache.filter(g => 
                g.ownerID === u.id && 
                g.members.cache.has(user.id)).map(g => {
                    // Customer Logging
                    const channel: TextChannel = this.client.channels.cache.get(this.client.settings.get(g, "config.logsChannel", null)) as TextChannel;
                    if (channel && channel.permissionsFor(g.me).has(["EMBED_LINKS", "SEND_MESSAGES"])) {
                        channel.send(new MessageEmbed()
                            .setAuthor(`${user.username}#${user.discriminator} | Account Unlinked`, `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`)
                            .setDescription(`This user has revoked you from pulling them into servers.`)
                            .addField("Unlinked At:", new Date().toLocaleString())
                            .setColor("#f44336")
                        ).catch(() => console.log("Error on customer logging."));
                    }
                });

            // Admin Logging
            const adminLog: TextChannel = this.client.channels.cache.get(LOGS_CHANNEL) as TextChannel;
            if (adminLog) adminLog.send(new MessageEmbed()
                .setAuthor(`${user.username}#${user.discriminator} | Account Unlinked`, `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`)
                .setDescription(`This user has unauthorized ${u.tag} (\`${u.id}\`) from pulling them into any server anytime.`)
                .addField("Unlinked At:", new Date().toLocaleString())
                .setColor("#f44336")
            ).catch(() => console.error());

            return res.status(201).json({
                error: false,
                response: req.body
            });
        }); 
    }
}