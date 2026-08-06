import { describe, expect, it } from "vitest"
import { renderSystemdUnit } from "./systemd-command.js"

const unit = (overrides: Partial<Parameters<typeof renderSystemdUnit>[0]> = {}) =>
    renderSystemdUnit({
        execPath: "/home/roman/n/bin/gueterbahnhof",
        configPath: "/home/roman/.gueterbahnhof",
        ...overrides,
    })

describe("renderSystemdUnit", () => {
    it("runs the binary directly, not through pm2", () => {
        const execStart = unit()
            .split("\n")
            .find(line => line.startsWith("ExecStart="))

        expect(execStart).toBe("ExecStart=/home/roman/n/bin/gueterbahnhof server --config /home/roman/.gueterbahnhof")
        // the comments mention pm2 deliberately; the command line must not
        expect(execStart).not.toContain("pm2")
    })

    it("sets KillMode=process so the daemon is not swept up with us", () => {
        const text = unit()

        expect(text).toContain("KillMode=process")
        // the reason must travel with the unit, or someone will 'tidy' it away
        expect(text).toMatch(/ADR-0003/)
    })

    it("restarts on failure and installs into the user target", () => {
        const text = unit()

        expect(text).toContain("Restart=always")
        expect(text).toContain("WantedBy=default.target")
        expect(text).toMatch(/TimeoutStopSec=\d+/)
    })

    it("passes through app dir and port when they are given explicitly", () => {
        const text = unit({ appDir: "/srv/apps", port: "8080" })

        expect(text).toContain("--app-dir /srv/apps")
        expect(text).toContain("--port 8080")
    })

    it("leaves them out otherwise, so the config file stays the single source", () => {
        const text = unit()

        expect(text).not.toContain("--app-dir")
        expect(text).not.toContain("--port")
    })

    it("never embeds the API key", () => {
        process.env.GUETERBAHNHOF_API_KEY = "super-secret"

        expect(unit()).not.toContain("super-secret")

        delete process.env.GUETERBAHNHOF_API_KEY
    })

    it("takes a custom description", () => {
        expect(unit({ description: "Gueterbahnhof (staging)" })).toContain("Description=Gueterbahnhof (staging)")
    })
})
