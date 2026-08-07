import { createServer } from "node:net"

// The Port Probe port, hand-written because this is the seam a test
// substitutes (ADR-0005): it is the only thing in port assignment that touches
// the network, and no test may bind a real socket.
//
// It exists solely to catch a foreign process — the Fleet's own claims are
// already known from the App Configs. Without it, a squatter would make an App
// fail on every boot forever, with nothing the operator could correct, because
// they never chose that port in the first place.
export type PortProbe = {
    isPortFree(port: number): Promise<boolean>
}

export const createPortProbe = (): PortProbe => ({
    isPortFree(port) {
        return new Promise<boolean>(resolve => {
            const probe = createServer()

            probe.once("error", () => resolve(false))
            // Wildcard rather than loopback: an App may bind either, and a
            // foreign process on 0.0.0.0 would collide with both.
            probe.listen({ port, host: "0.0.0.0", exclusive: true }, () => {
                probe.close(() => resolve(true))
            })
        })
    },
})
