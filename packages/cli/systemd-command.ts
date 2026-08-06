import { execFileSync } from "node:child_process"
import { userInfo } from "node:os"
import { command } from "cleye"
import { DEFAULT_CONFIG_PATH } from "./server-config.js"

export type SystemdUnitOptions = {
    execPath: string
    configPath: string
    appDir?: string
    port?: string
    description?: string
}

// Pure: Server Config in, unit text out. Keeps systemd out of the tests.
export const renderSystemdUnit = ({
    execPath,
    configPath,
    appDir,
    port,
    description = "Gueterbahnhof deployment server",
}: SystemdUnitOptions) => {
    const args = ["server", "--config", configPath]

    if (appDir) {
        args.push("--app-dir", appDir)
    }
    if (port) {
        args.push("--port", port)
    }

    return `[Unit]
Description=${description}
After=network.target

[Service]
Type=simple
ExecStart=${execPath} ${args.join(" ")}
Restart=always
RestartSec=5

# Signal gueterbahnhof only. It auto-spawns the pm2 daemon, which therefore
# lands in this unit's cgroup, and systemd's default KillMode=control-group
# would SIGKILL that daemon along with every app it supervises — including
# processes gueterbahnhof never configured. Gueterbahnhof's own SIGTERM
# handler stops its fleet gracefully — see ADR-0003 (external pm2 daemon).
KillMode=process
TimeoutStopSec=60

[Install]
WantedBy=default.target
`
}

const readLingerState = (user: string) => {
    try {
        const output = execFileSync("loginctl", ["show-user", user, "--property=Linger"], {
            encoding: "utf8",
            stdio: ["ignore", "pipe", "ignore"],
        })

        return output.trim().endsWith("=yes") ? "enabled" : "disabled"
    } catch {
        return "unknown"
    }
}

const createSystemdCommand = () =>
    command(
        {
            name: "systemd",
            flags: {
                config: {
                    type: String,
                    description: "path to the config file the unit should read",
                    default: DEFAULT_CONFIG_PATH,
                },
                appDir: {
                    type: String,
                    description: "put --app-dir in the unit instead of taking it from the config file",
                    default: "",
                },
                port: {
                    type: String,
                    description: "put --port in the unit instead of taking it from the config file",
                    default: "",
                },
                description: {
                    type: String,
                    description: "unit description",
                    default: "Gueterbahnhof deployment server",
                },
                execPath: {
                    type: String,
                    description: "path to the gueterbahnhof binary (defaults to the running one)",
                    default: "",
                },
            },
            help: {
                description: "Print a systemd user unit for running the server.",
            },
        },
        argv => {
            const execPath = argv.flags.execPath || process.argv[1]

            if (!execPath) {
                console.error("Could not determine the gueterbahnhof binary path — pass --exec-path.")
                process.exitCode = 1
                return
            }

            // Unit to stdout so it can be redirected; everything else to stderr.
            console.log(
                renderSystemdUnit({
                    execPath,
                    configPath: argv.flags.config,
                    appDir: argv.flags.appDir || undefined,
                    port: argv.flags.port || undefined,
                    description: argv.flags.description,
                }),
            )

            const user = userInfo().username
            const linger = readLingerState(user)

            console.error(
                [
                    "",
                    "Install it with:",
                    "  mkdir -p ~/.config/systemd/user",
                    "  gueterbahnhof systemd > ~/.config/systemd/user/gueterbahnhof.service",
                    "  systemctl --user daemon-reload",
                    "  systemctl --user enable --now gueterbahnhof",
                    "",
                    `Put the server's settings in ${argv.flags.config} (chmod 600), for example:`,
                    "  GUETERBAHNHOF_APP_DIR=/path/to/appdir",
                    "  GUETERBAHNHOF_PORT=4444",
                    "  GUETERBAHNHOF_API_KEY=...",
                    "",
                    linger === "enabled"
                        ? `Lingering is enabled for ${user}, so this starts at boot.`
                        : linger === "disabled"
                          ? `Lingering is DISABLED for ${user}: a user unit only starts at boot once you run\n  loginctl enable-linger ${user}`
                          : `Could not read the lingering state for ${user}. Without lingering a user unit does not start at boot:\n  loginctl enable-linger ${user}`,
                    "",
                ].join("\n"),
            )
        },
    )

export default createSystemdCommand
