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
}: {
    onSave?: (patch: AppConfigPatch) => Promise<SaveOutcome>
    defaultTab?: "list" | "dotenv"
} = {}) => {
    render(<AppConfigForm config={config} onSave={onSave} onDelete={vi.fn()} defaultTab={defaultTab} />)
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
})
