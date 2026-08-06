import { spawn } from "node:child_process"
import { createRequire } from "node:module"
import { command } from "cleye"

export type LogsInvocationOptions = {
    unit: string
    lines: number
    follow: boolean
    errors: boolean
    app?: string
    passthrough?: string[]
}

export type LogsInvocation = {
    kind: "server" | "app"
    command: string
    args: string[]
}

// Pure: options in, argv out. Keeps journalctl and pm2 out of the tests.
export const resolveLogsInvocation = ({
    unit,
    lines,
    follow,
    errors,
    app,
    passthrough = [],
}: LogsInvocationOptions): LogsInvocation => {
    if (app) {
        const args = ["logs", app, "--lines", String(lines)]

        // pm2 streams by default, so not following is the flag worth passing.
        if (!follow) {
            args.push("--nostream")
        }
        if (errors) {
            args.push("--err")
        }

        return { kind: "app", command: "pm2", args: [...args, ...passthrough] }
    }

    const args = ["--user", "-u", unit, "-n", String(lines)]

    if (follow) {
        args.push("-f")
    }
    if (errors) {
        // Only meaningful because the server prefixes its errors with <3>;
        // see journald-logging.ts.
        args.push("-p", "err")
    }

    return { kind: "server", command: "journalctl", args: [...args, ...passthrough] }
}

// Use the pm2 we depend on rather than whatever is on PATH: it is the same
// copy that spawned the daemon, and pm2 refuses a version-mismatched client.
const resolvePm2Binary = () => {
    try {
        return createRequire(import.meta.url).resolve("pm2/bin/pm2")
    } catch {
        return "pm2"
    }
}

const createLogsCommand = () =>
    command(
        {
            name: "logs",
            parameters: ["[app]"],
            flags: {
                lines: {
                    type: Number,
                    alias: "n",
                    description: "how many lines to show",
                    default: 100,
                },
                follow: {
                    type: Boolean,
                    alias: "f",
                    description: "keep streaming new output",
                    default: false,
                },
                errors: {
                    type: Boolean,
                    description: "only show errors",
                    default: false,
                },
                unit: {
                    type: String,
                    description: "systemd unit holding the server's logs",
                    default: "gueterbahnhof",
                },
            },
            help: {
                description: "Show the server's logs, or an app's when you name one.",
            },
        },
        argv => {
            const invocation = resolveLogsInvocation({
                unit: argv.flags.unit,
                lines: argv.flags.lines,
                follow: argv.flags.follow,
                errors: argv.flags.errors,
                app: argv._.app,
                // Everything after `--` goes to journalctl or pm2 untouched.
                passthrough: argv._["--"],
            })

            const binary = invocation.kind === "app" ? resolvePm2Binary() : invocation.command

            const child = spawn(binary, invocation.args, { stdio: "inherit" })

            child.on("error", error => {
                console.error(`Could not run ${invocation.command}:`, (error as Error).message)
                process.exitCode = 1
            })

            child.on("exit", (code, signal) => {
                process.exitCode = signal ? 1 : (code ?? 0)
            })
        },
    )

export default createLogsCommand
