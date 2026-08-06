// systemd records everything a service writes — stdout *and* stderr — at
// priority info unless the line starts with a syslog prefix like <3>. Without
// this, `journalctl -p err` shows nothing and `systemctl status` cannot colour
// real failures. systemd sets JOURNAL_STREAM when it owns our output, so the
// prefixes appear under systemd and never in a plain terminal.

const SYSLOG_ERR = "<3>"
const SYSLOG_WARNING = "<4>"

// Marker on the patched console rather than module state, so this stays
// idempotent without becoming untestable.
const PATCHED = Symbol.for("gueterbahnhof.journald-prefixes")

type PatchableConsole = Pick<Console, "error" | "warn"> & { [PATCHED]?: boolean }

const withPrefix = (prefix: string, args: unknown[]) =>
    typeof args[0] === "string" ? [`${prefix}${args[0]}`, ...args.slice(1)] : [prefix, ...args]

export const applyJournaldPriorityPrefixes = ({
    env = process.env,
    target = console,
}: {
    env?: NodeJS.ProcessEnv
    target?: PatchableConsole
} = {}) => {
    if (!env.JOURNAL_STREAM) {
        return false
    }

    if (target[PATCHED]) {
        return true
    }

    const { error, warn } = target

    target.error = (...args: unknown[]) => error(...withPrefix(SYSLOG_ERR, args))
    target.warn = (...args: unknown[]) => warn(...withPrefix(SYSLOG_WARNING, args))
    target[PATCHED] = true

    return true
}
