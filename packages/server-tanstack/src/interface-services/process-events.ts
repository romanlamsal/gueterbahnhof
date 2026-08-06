// The Process Events port: one subscription, domain-shaped. The pm2 adapter is
// where pm2's bus payload is validated and normalised, because that is the only
// place data arrives from outside.

export type ProcessStateChange = {
    name: string
    status: string
}

export type ProcessEvents = {
    /** Subscribe to state changes; resolves once the subscription is live. */
    subscribe(onChange: (change: ProcessStateChange) => void): Promise<void>
}
