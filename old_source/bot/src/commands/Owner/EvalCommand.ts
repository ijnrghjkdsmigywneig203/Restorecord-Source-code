import { Command } from "discord-akairo";
import { Message, Util } from "discord.js";
import * as util from "util";

const NL = "!!NL!!";
const NL_PATTERN = new RegExp(NL, "g");
    
export default class EvalCommand extends Command {
	public hrStart: [number, number] | undefined;

	public lastResult: any = null;

	private readonly _sensitivePattern!: any;

	public constructor() {
		super("eval", {
			aliases: ["eval", "e"],
			category: "Owner",
			description: {
                content: "Evaluate JavaScript Code",
                usage: "eval [ code ]",
                examples: [
                    "eval message.author.id;",
                    "eval this.client.users.fetch(message.author.id).then(doReply);",
                    "eval 2 + 3;"
                ]
			},
			ownerOnly: true,
			args: [
				{
					id: "depth",
					type: "number",
					match: "option",
					flag: ["--depth=", "-d="],
					default: 0
				},
				{
					id: "code",
					match: "rest",
					type: "string",
					prompt: {
						start: (message: Message): string => `${message.author}, what would you like to evaluate?`
					}
				}
			]
		});
	}

	public async exec(message: Message, { code, depth }: { code: string, depth: number }): Promise<Message | Message[]> {
		const msg = message;
		const { client, lastResult } = this;
		const doReply = (val: string | Error) => {
            if (val instanceof Error) {
                message.util!.send(`Callback error: \`${val}\``);
            } else {
                const result = this._result(val, process.hrtime(this.hrStart));
                for (const res of result) message.util!.send(res);
            }
        };

		let hrDiff;
		try {
			const hrStart = process.hrtime();
			this.lastResult = eval(code);
			hrDiff = process.hrtime(hrStart);
		} catch (error) {
			return message.util!.send(`Error while evaluating: \`${error}\``);
		}

		this.hrStart = process.hrtime();
		const result = this._result(this.lastResult, hrDiff, code, depth);
		// @ts-ignore
		if (Array.isArray(result)) return result.map(async (res): Promise<Message | Message[]> => message.util.send(res));
		return message.util!.send(result);
	}

	private _result(result: any, hrDiff: [number, number], input: string | null = null, depth?: number): string | string[] {
		const inspected = util.inspect(result, { depth: depth })
			.replace(NL_PATTERN, "\n")
			.replace(this.sensitivePattern, "--snip--");
		const split = inspected.split("\n");
		const last = inspected.length - 1;
		const prependPart = inspected[0] !== "{" && inspected[0] !== "[" && inspected[0] !== '"' ? split[0] : inspected[0];
		const appendPart = inspected[last] !== "}" && inspected[last] !== "]" && inspected[last] !== '"' ? split[split.length - 1] : inspected[last];
		const prepend = `\`\`\`js\n${prependPart}\n`;
		const append = `\n${appendPart}\n\`\`\``;
		if (input) {
			return Util.splitMessage(`*Executed in ${hrDiff[0] > 0 ? `${hrDiff[0]}s ` : ""}${hrDiff[1] / 1000000}ms.*\n\`\`\`js\n${inspected}\n\`\`\``, { 
                maxLength: 1900, 
                prepend, 
                append 
            });
		}

		return Util.splitMessage(`*Callback executed after ${hrDiff[0] > 0 ? `${hrDiff[0]}s ` : ""}${hrDiff[1] / 1000000}ms.*\n\`\`\`js\n${inspected}\n\`\`\``, { 
            maxLength: 1900, 
            prepend, 
            append 
        });
	}

	private get sensitivePattern(): any {
		if (!this._sensitivePattern) {
			const token = this.client.token!.split("").join("[^]{0,2}");
			const revToken = this.client.token!.split("").reverse().join("[^]{0,2}");
			Object.defineProperty(this, "_sensitivePattern", { value: new RegExp(`${token}|${revToken}`, "g") });
		}
		return this._sensitivePattern;
	}
}