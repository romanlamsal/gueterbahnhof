import { EventEmitter } from "node:events"
import type { z } from "zod"

type EventMap<TSchema extends { type: string }> = {
    [K in TSchema["type"]]: Extract<TSchema, { type: K }>
}

export interface TypedEventEmitter<TSchema extends { type: string }> {
    on<K extends TSchema["type"]>(event: K, listener: (data: EventMap<TSchema>[K]) => void, signal?: AbortSignal): void
    off<K extends TSchema["type"]>(event: K, listener: (data: EventMap<TSchema>[K]) => void): void
    emit(data: TSchema): void
}

export const createTypedEventEmitter = <TSchema extends { type: string }>(
    schema: z.ZodType<TSchema>,
): TypedEventEmitter<TSchema> => {
    if (typeof window !== "undefined") {
        const eventTarget = new EventTarget()

        const listenerToEventListener = new Map<unknown, EventListener>()

        return {
            on(event, listener, signal) {
                const eventListener: EventListener = evt => {
                    const { data } = schema.safeParse((evt as CustomEvent).detail)

                    if (!data || data.type !== event) {
                        return
                    }

                    listener(data as EventMap<TSchema>[typeof event])
                }

                eventTarget.addEventListener(event, eventListener, signal ? { signal } : {})

                listenerToEventListener.set(listener, eventListener)
                if (signal) {
                    signal.addEventListener("abort", () => eventTarget.removeEventListener(event, eventListener))
                }
            },
            off(event, listener) {
                const eventListener = listenerToEventListener.get(listener)
                if (!eventListener) {
                    console.warn("Tried to remove a listener but could not find the appropriate eventListener.")
                    return
                }
                eventTarget.removeEventListener(event, eventListener)
            },

            emit(data) {
                const { data: detail } = schema.safeParse(data)

                if (!detail) {
                    return
                }

                eventTarget.dispatchEvent(new CustomEvent(data.type, { detail }))
            },
        }
    }

    const emitter = new EventEmitter()

    return {
        on<K extends TSchema["type"]>(
            event: K,
            listener: (data: EventMap<TSchema>[K]) => void,
            signal?: AbortSignal,
        ): void {
            emitter.on(event, listener)

            if (signal) {
                signal.addEventListener("abort", () => {
                    emitter.off(event, listener)
                })
            }
        },

        off<K extends TSchema["type"]>(event: K, listener: (data: EventMap<TSchema>[K]) => void): void {
            emitter.off(event, listener)
        },

        emit(data: TSchema): void {
            const parsed = schema.parse(data)
            emitter.emit(parsed.type, parsed)
        },
    }
}
