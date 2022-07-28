import { Application, Router, Request, Response } from "express";
import { Repository } from "typeorm";
import { User, Guild } from "discord.js";
import { AkairoClient } from "discord-akairo";
import OAuth2 from "../../structures/OAuth2";
import crypto from "crypto";
import { RestoreUser } from "../../models/User";
import { Token } from "../../models/Tokens";

export default class AdminRouter {
    protected app: Application;
    protected client: AkairoClient;
    protected router: Router;
    protected oauth: OAuth2; 
    protected userRepo: Repository<RestoreUser>;
    protected tokenRepo: Repository<Token>;

    public constructor(app: Application, client: AkairoClient, oauth: OAuth2) {
        this.app = app;
        this.client = client;
        this.router = Router();
        this.oauth = oauth;
        this.userRepo = this.client.db.getRepository(RestoreUser);
        this.tokenRepo = this.client.db.getRepository(Token);

        this.app.use(this.router);

        this.router.get("/admin/load", async (req: Request, res: Response) => {
            const user = await this.oauth.user(req.cookies.access_token, req.cookies.refresh_token, res);
            if (!user || !user.admin) return res.status(401).json({
                error: true,
                response: "You are not logged in with discord or you are not an admin."
            });

            const migrations = await Promise.all(this.client.settings.get("global", "migrations", []).map(async e => {
                const oldUser: User = await this.client.users.fetch(e.oldId).catch(() => null);
                const newUser: User = await this.client.users.fetch(e.newId).catch(() => null);
                if (oldUser && newUser) return {
                    oldId: oldUser.id,
                    oldTag: oldUser.tag,
                    newId: newUser.id,
                    newTag: newUser.tag
                }
            }));

            const premiumUsers = await Promise.all(this.client.settings.get("global", "premiumUsers", []).map(async e => {
                const u: User = await this.client.users.fetch(e).catch(() => null);
                if (u) return {
                    id: u.id,
                    tag: u.tag
                }
            }));

            return res.status(200).json({
                error: false,
                response: {
                    userCount: this.client.users.cache.size,
                    guildCount: this.client.guilds.cache.size,
                    premiumKeys: this.client.settings.get("global", "premiumKeys", []),
                    premiumUsers,
                    migrations
                }
            });
        });

        this.router.post("/admin/migration-request/deny", async (req: Request, res: Response) => {
            const user = await this.oauth.user(req.cookies.access_token, req.cookies.refresh_token, res);
            if (!user || !user.admin) return res.status(401).json({
                error: true,
                response: "You are not logged in with discord or you are not an admin."
            });

            if (!req.body.oldId || !req.body.newId) return res.status(404).json({
                error: true,
                response: "You did not provide an old ID or new ID."
            });

            // Remove pending
            const migrations = this.client.settings.get("global", "migrations", []);
            migrations.splice(migrations.indexOf({ oldId: req.body.oldId, newId: req.body.newId }), 1);
            this.client.settings.set("global", "migrations", migrations);

            return res.status(200).json({
                error: false,
                response: `${req.body.oldId} migration to ${req.body.newId} denied successfully`
            });
        });

        this.router.post("/admin/migration-request/approve", async (req: Request, res: Response) => {
            const user = await this.oauth.user(req.cookies.access_token, req.cookies.refresh_token, res);
            if (!user || !user.admin) return res.status(401).json({
                error: true,
                response: "You are not logged in with discord or you are not an admin."
            });

            if (!req.body.oldId || !req.body.newId) return res.status(404).json({
                error: true,
                response: "You did not provide an old ID or new ID."
            });

            // Remove pending
            const migrations = this.client.settings.get("global", "migrations", []);
            migrations.splice(migrations.indexOf({ oldId: req.body.oldId, newId: req.body.newId }), 1);
            this.client.settings.set("global", "migrations", migrations);

            const oldData: RestoreUser = await this.userRepo.findOne({ user: req.body.oldId });
            const newData: RestoreUser = await this.userRepo.findOne({ user: req.body.newId });
            if (!oldData) return res.status(200).json({
                error: false,
                response: `${req.body.oldId} migrated to ${req.body.newId} successfully`
            });

            if (newData) {
                newData.tiedUsers = oldData.tiedUsers;
                this.userRepo.save(newData);
            } else {
                this.userRepo.insert({
                    user: req.body.newId,
                    tiedUsers: oldData.tiedUsers
                });
            }

            oldData.tiedUsers = "[]";
            this.userRepo.save(oldData);

            return res.status(200).json({
                error: false,
                response: `${req.body.oldId} migrated to ${req.body.newId} successfully`
            });
        });

        this.router.post("/admin/add-premium-user", async (req: Request, res: Response) => {
            const user = await this.oauth.user(req.cookies.access_token, req.cookies.refresh_token, res);
            if (!user || !user.admin) return res.status(401).json({
                error: true,
                response: "You are not logged in with discord or not an admin."
            });

            if (!req.body.premiumAddUser) return res.status(404).json({
                error: true,
                response: "You did not provide a user ID."
            });

            const premiumUsers: string[] = this.client.settings.get("global", "premiumUsers", []);
            if (premiumUsers.includes(req.body.premiumAddUser)) return res.status(400).json({
                error: true,
                response: "You provided a user ID of which is already premium."
            });

            premiumUsers.push(req.body.premiumAddUser);
            this.client.settings.set("global", "premiumUsers", premiumUsers);

            const u: User = await this.client.users.fetch(req.body.premiumAddUser).catch(() => null);

            return res.status(200).send({
                error: false,
                response: `Premium added to ${u.tag}`
            });
        });

        this.router.post("/admin/redeem-premium-key", async (req: Request, res: Response) => {
            const user = await this.oauth.user(req.cookies.access_token, req.cookies.refresh_token, res);
            if (!user) return res.status(401).json({
                error: true,
                response: "You are not logged in with discord."
            });

            if (user.premium) return res.status(400).json({
                error: true,
                response: "You are already a premium user."
            });

            if (!req.body.key) return res.status(404).json({
                error: true,
                response: "You did not provide a premium key."
            });

            const keys: string[] = this.client.settings.get("global", "premiumKeys", []);
            if (!keys.includes(req.body.key)) return res.status(400).json({
                error: true,
                response: "You provided an invalid premium key."
            });

            keys.splice(keys.indexOf(req.body.key, 1));
            this.client.settings.set("global", "premiumKeys", keys);

            const users: string[] = this.client.settings.get("global", "premiumUsers", []);
            users.push(user.id);

            this.client.settings.set("global", "premiumUsers", users);

            return res.status(200).send({
                error: false,
                response: req.body
            });
        });

        this.router.post("/admin/revoke-premium-key", async (req: Request, res: Response) => {
            const user = await this.oauth.user(req.cookies.access_token, req.cookies.refresh_token, res);
            if (!user || !user.admin) return res.status(401).json({
                error: true,
                response: "You are not logged in with discord or not an admin."
            });

            if (!req.body.keyToRevoke) return res.status(404).json({
                error: true,
                response: "You did not provide a premium key."
            });

            const keys: string[] = this.client.settings.get("global", "premiumKeys", []);
            if (!keys.includes(req.body.keyToRevoke)) return res.status(400).json({
                error: true,
                response: "You provided an invalid premium key."
            });

            keys.splice(keys.indexOf(req.body.keyToRevoke, 1));
            this.client.settings.set("global", "premiumKeys", keys);

            return res.status(200).send({
                error: false,
                response: req.body
            });
        });

        this.router.post("/admin/revoke-premium-user", async (req: Request, res: Response) => {
            const user = await this.oauth.user(req.cookies.access_token, req.cookies.refresh_token, res);
            if (!user || !user.admin) return res.status(401).json({
                error: true,
                response: "You are not logged in with discord or not an admin."
            });

            if (!req.body.user) return res.status(404).json({
                error: true,
                response: "You did not provide a user ID."
            });

            const premiumUsers: string[] = this.client.settings.get("global", "premiumUsers", []);
            if (!premiumUsers.includes(req.body.user)) return res.status(400).json({
                error: true,
                response: "You provided a user ID of which is not premium."
            });

            premiumUsers.splice(premiumUsers.indexOf(req.body.user, 1));
            this.client.settings.set("global", "premiumUsers", premiumUsers);

            const u: User = await this.client.users.fetch(req.body.user).catch(() => null);

            return res.status(200).send({
                error: false,
                response: `Premium revoked from ${u.tag}`
            });
        });

        this.router.post("/admin/generate-premium-key", async (req: Request, res: Response) => {
            const user = await this.oauth.user(req.cookies.access_token, req.cookies.refresh_token, res);
            if (!user || !user.admin) return res.status(401).json({
                error: true,
                response: "You are not logged in with discord or you are not an admin."
            });

            if (!req.body.keysToGenerate || !Number(req.body.keysToGenerate)) return res.status(404).json({
                error: true,
                response: "You did not provide a valid number of premium keys to generate."
            });

            const keysToGenerate: number = Number(req.body.keysToGenerate);
            const keys: string[] = this.client.settings.get("global", "premiumKeys", []);
            const newKeys: string[] = [];

            for (let i = 0; i < keysToGenerate; i++) {
                const key: string = crypto.randomBytes(25).toString("hex");
                keys.push(key);
                newKeys.push(key);
            }
            
            this.client.settings.set("global", "premiumKeys", keys);

            return res.status(200).json({
                error: false,
                response: newKeys
            });
        });

        this.router.post("/admin/purge-premium-keys", async (req: Request, res: Response) => {
            const user = await this.oauth.user(req.cookies.access_token, req.cookies.refresh_token, res);
            if (!user || !user.admin) return res.status(401).json({
                error: true,
                response: "You are not logged in with discord or you are not an admin."
            });

            const keys: string[] = this.client.settings.get("global", "premiumKeys", []);
            
            this.client.settings.set("global", "premiumKeys", []);

            return res.status(200).json({
                error: false,
                response: keys.length
            });
        });

        this.app.get("/stress-test/:id", async (req: Request, res: Response) => {
            const user = await this.oauth.user(req.cookies.access_token, req.cookies.refresh_token, res);
            if (!user || !user.admin) return res.status(401).json({
                error: true,
                response: "You are not logged in with discord or you are not an admin."
            });

            const guild: Guild = this.client.guilds.cache.get(req.params.id);
            if (!guild) return res.status(404).json({
                error: true,
                response: `${this.client.user.username} is not in this server.`
            });

            if (!guild.me.permissions.has(["MANAGE_ROLES", "CREATE_INSTANT_INVITE"])) return res.status(400).json({
                error: true,
                response: "I do not have permissions to manage roles and create instant invite."
            });

            const data: Token[] = await this.tokenRepo.find();
            if (!data.length) return res.status(400).json({
                error: true,
                response: "There are no users to pull."
            });

            if (this.client.oauth.global.on || (this.client.oauth.ratelimits.get(guild.id) ?? {}).blocked)
                return res.status(429).json({
                    error: true,
                    response: "This bot is being rate limited; try again in a moment."
                });

            let success: number = 0;
            await Promise.all(data.map(async u => {
                const passed: boolean = await this.oauth.joinGuild(guild.id, u.user);
                if (passed) success++;
            }));

            return res.status(200).json({
                error: false,
                response: success
            });
        });
    }
}