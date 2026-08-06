import handler, { createServerEntry } from "@tanstack/react-start/server-entry"

// No boot work here by design (ADR-0003): the CLI owns the fleet's lifecycle
// and runs it before this module is ever evaluated. Nitro reaches this entry
// lazily, on the first render, which is exactly why nothing important may live
// here. The server's own pm2 client connects on demand — see
// pm2-process-manager's connectProcessManager.

export default createServerEntry({
    fetch(request) {
        return handler.fetch(request)
    },
})
