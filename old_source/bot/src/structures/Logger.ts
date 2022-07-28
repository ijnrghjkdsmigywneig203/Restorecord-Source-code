import util from "util";

export default class Logger {
    private getTime(): string {
        return "\x1b[36m" + new Date().toLocaleString() + "\x1b[37m";
    }

    private checkContent(content: any): any {
        if (typeof content !== "string") {
            content = util.inspect(content, { depth: 2, colors: true });
        }

        return content;
    }

    init(content: string): void {
        return console.log(`[ ${this.getTime()} ] [ ` + "\x1b[31m" + "INIT" + "\x1b[37m" + ` ]: ${content}`);
    }

    debug(content: any): void {
        return console.log(`[ ${this.getTime()} ] [ ` + "\x1b[32m" + "DEBUG" + "\x1b[37m" + ` ]: ${this.checkContent(content)}`);
    }

    error(content: any): void {
        return console.log(`[ ${this.getTime()} ] [ ` + "\x1b[33mm" + "ERROR" + "\x1b[37m" + ` ]: ${this.checkContent(content)}`);
    }
}