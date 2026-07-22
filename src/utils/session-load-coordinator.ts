export interface SessionLoadTicket {
  promise: Promise<void>
  isCurrent: () => boolean
}

export interface SessionLoadCoordinatorOptions<SessionKey> {
  onSessionChange?: (previous: SessionKey, next: SessionKey) => void
}

export function createSessionLoadCoordinator<SessionKey>(
  options?: SessionLoadCoordinatorOptions<SessionKey>
) {
  let generation = 0
  let hasSession = false
  let currentSessionKey: SessionKey
  let inFlight: {
    sessionKey: SessionKey
    owner: symbol
    ticket: SessionLoadTicket
  } | null = null

  function begin(
    sessionKey: SessionKey,
    load: (isCurrent: () => boolean) => Promise<void>
  ): SessionLoadTicket {
    if (inFlight && Object.is(inFlight.sessionKey, sessionKey)) return inFlight.ticket

    if (hasSession && !Object.is(currentSessionKey, sessionKey)) {
      options?.onSessionChange?.(currentSessionKey, sessionKey)
    }
    currentSessionKey = sessionKey
    hasSession = true
    const requestGeneration = ++generation
    const isCurrent = () => generation === requestGeneration
    const owner = Symbol('session-load')
    let loadPromise: Promise<void>
    try {
      loadPromise = Promise.resolve(load(isCurrent))
    } catch (err) {
      loadPromise = Promise.reject(err)
    }

    const ticket: SessionLoadTicket = {
      promise: loadPromise.finally(() => {
        if (inFlight?.owner === owner) inFlight = null
      }),
      isCurrent
    }
    inFlight = { sessionKey, owner, ticket }
    return ticket
  }

  return { begin }
}
