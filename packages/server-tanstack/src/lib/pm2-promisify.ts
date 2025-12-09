import pm2 from "pm2"

interface CallbackFn<CallbackReturn> {
    (err: Error, cbReturn?: never): void
    (err: Error, cbReturn: CallbackReturn): void
}

export const promisify = <Params, CallbackResult>(
    cb: (params: Params, errCallback: CallbackFn<CallbackResult>) => void,
) => {
    return (params: Params) =>
        new Promise<
            | { ok: false; err: Error; result?: never }
            | { ok: true; err?: never; result: CallbackResult | undefined }
        >(resolve => {
            cb.bind(pm2)(params, (err, result) => {
                if (err) {
                    return resolve({ ok: false, err })
                }

                return resolve({ ok: true, result })
            })
        })
}
