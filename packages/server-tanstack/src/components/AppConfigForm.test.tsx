// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { AppConfigForm, type AppConfigPatch, type SaveOutcome } from "./AppConfigForm.tsx"

// Both bugs this component was written to fix were handlers that silently went
// missing rather than logic errors, so these tests drive it like an operator.

const config = { id: "id-1", name: "my-app", entry: "index.js", env: { EXISTING: "yes" } }

const renderForm = ({
    onSave = vi.fn(async (): Promise<SaveOutcome> => ({ ok: true })),
    defaultTab = "dotenv",
    config: override = config,
}: {
    onSave?: (patch: AppConfigPatch) => Promise<SaveOutcome>
    defaultTab?: "list" | "dotenv"
    config?: typeof config & { port?: number }
} = {}) => {
    render(<AppConfigForm config={override} onSave={onSave} onDelete={vi.fn()} defaultTab={defaultTab} />)
    return { onSave }
}

const save = () => fireEvent.submit(screen.getByRole("button", { name: "Save" }).closest("form") as HTMLFormElement)

afterEach(cleanup)

describe("AppConfigForm", () => {
    it("saves name, entry and env together", async () => {
        const { onSave } = renderForm()

        save()

        await waitFor(() =>
            expect(onSave).toHaveBeenCalledWith({
                name: "my-app",
                entry: "index.js",
                env: { EXISTING: "yes" },
            }),
        )
    })

    it("includes what was typed into the dotenv textarea — the edit that used to be discarded", async () => {
        const { onSave } = renderForm()

        fireEvent.change(screen.getByLabelText("Env as dotenv"), {
            target: { value: "EXISTING=yes\nADDED=from-textarea\nWITH_EQUALS=a=b" },
        })
        save()

        await waitFor(() =>
            expect(onSave).toHaveBeenCalledWith(
                expect.objectContaining({
                    env: { EXISTING: "yes", ADDED: "from-textarea", WITH_EQUALS: "a=b" },
                }),
            ),
        )
    })

    it("picks up dotenv edits even without leaving the textarea", async () => {
        const { onSave } = renderForm()

        // no blur between typing and submitting
        fireEvent.change(screen.getByLabelText("Env as dotenv"), { target: { value: "ONLY=this" } })
        save()

        await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ env: { ONLY: "this" } })))
    })

    it("edits made in the list tab are saved too", async () => {
        const { onSave } = renderForm({ defaultTab: "list" })

        fireEvent.change(screen.getByLabelText("Env value 1"), { target: { value: "changed" } })
        save()

        await waitFor(() =>
            expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ env: { EXISTING: "changed" } })),
        )
    })

    it("confirms a successful save", async () => {
        renderForm()

        save()

        expect(await screen.findByLabelText("Saved")).toBeDefined()
        expect(screen.queryByRole("alert")).toBeNull()
    })

    it("shows the reason when a save fails, and no confirmation", async () => {
        renderForm({ onSave: vi.fn(async () => ({ ok: false, message: "Another app already uses this name." })) })

        save()

        const alert = await screen.findByRole("alert")
        expect(alert.textContent).toBe("Another app already uses this name.")
        expect(screen.queryByLabelText("Saved")).toBeNull()
    })

    it("disables the button while the save is in flight", async () => {
        // Held open so the button can be observed mid-save, then released.
        let release!: (outcome: SaveOutcome) => void
        const onSave = vi.fn(
            () =>
                new Promise<SaveOutcome>(resolve => {
                    release = resolve
                }),
        )
        renderForm({ onSave })

        save()

        const button = screen.getByRole("button", { name: "Save" }) as HTMLButtonElement
        await waitFor(() => expect(button.disabled).toBe(true))

        release({ ok: true })
        await waitFor(() => expect(button.disabled).toBe(false))
    })

    it("copies the env escaped, whatever the escaped toggle says", async () => {
        const writeText = vi.fn(async () => undefined)
        Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true })
        renderForm()

        // quoted, so the '#' is part of the value rather than a comment
        fireEvent.change(screen.getByLabelText("Env as dotenv"), { target: { value: 'GNARLY="a b#c"' } })
        fireEvent.click(screen.getByRole("button", { name: /Copy escaped/ }))

        await waitFor(() => expect(writeText).toHaveBeenCalledWith("GNARLY=a%20b%23c"))
        expect(await screen.findByLabelText("Copied")).toBeDefined()
    })

    describe("the Proxy Host field", () => {
        it("saves what was typed", async () => {
            const { onSave } = renderForm()

            fireEvent.change(screen.getByLabelText<HTMLInputElement>("Proxy Host"), {
                target: { value: "api.example.com" },
            })
            save()

            await waitFor(() =>
                expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ proxyHost: "api.example.com" })),
            )
        })

        it("saves nothing when empty, which is what leaves the App unproxied", async () => {
            const { onSave } = renderForm()

            save()

            await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ proxyHost: undefined })))
        })

        it("says what leaving it empty means", () => {
            renderForm()

            expect(screen.getByText(/leave empty for no host-based proxying/i)).toBeDefined()
        })
    })

    // The Port has a field of its own, so the Env editor must not offer a
    // second place to change it — and an App configured before that field
    // existed has to keep running on exactly the port it runs on now.
    describe("the Port field", () => {
        const withEnvPort = { ...config, env: { EXISTING: "yes", PORT: "3001" } }

        it("saves a typed port as a number", async () => {
            const { onSave } = renderForm()

            fireEvent.change(screen.getByLabelText<HTMLInputElement>("Port"), { target: { value: "20001" } })
            save()

            await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ port: 20001 })))
        })

        it("saves no port when the field is empty, which is what makes it assignable", async () => {
            const { onSave } = renderForm()

            save()

            await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ port: undefined })))
        })

        it("prefills from the Env when the App has no port of its own, and says it was inherited", () => {
            renderForm({ config: withEnvPort })

            expect(screen.getByLabelText<HTMLInputElement>("Port").value).toBe("3001")
            expect(screen.getByText(/inherited from the PORT environment variable/i)).toBeDefined()
        })

        it("shows a declared port without calling it inherited", () => {
            renderForm({ config: { ...withEnvPort, port: 20001 } })

            expect(screen.getByLabelText<HTMLInputElement>("Port").value).toBe("20001")
            expect(screen.queryByText(/inherited/i)).toBeNull()
        })

        it("says what leaving it empty means", () => {
            renderForm()

            expect(screen.getByText(/assigned automatically, if a proxy host is set/i)).toBeDefined()
        })

        it("keeps PORT out of the dotenv view", () => {
            renderForm({ config: withEnvPort })

            expect(screen.getByLabelText<HTMLTextAreaElement>("Env as dotenv").value).toBe("EXISTING=yes")
        })

        it("keeps PORT out of the list view", () => {
            renderForm({ config: withEnvPort, defaultTab: "list" })

            const names = screen
                .getAllByLabelText<HTMLInputElement>(/^Env name /)
                .map(input => input.value)
                .filter(Boolean)

            expect(names).toEqual(["EXISTING"])
        })

        it("promotes an inherited port on save, submitting an Env without PORT", async () => {
            const { onSave } = renderForm({ config: withEnvPort })

            save()

            // Same effective port either way — the value simply moves house.
            await waitFor(() =>
                expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ port: 3001, env: { EXISTING: "yes" } })),
            )
        })

        it("refuses to submit PORT typed into the dotenv textarea", async () => {
            const { onSave } = renderForm()

            fireEvent.change(screen.getByLabelText("Env as dotenv"), {
                target: { value: "EXISTING=yes\nPORT=9999" },
            })
            save()

            await waitFor(() =>
                expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ env: { EXISTING: "yes" } })),
            )
        })
    })
})
