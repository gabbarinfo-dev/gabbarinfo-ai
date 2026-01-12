// lib/instagram/resolve-context.js

export function resolveContext(instruction, state) {
    // 1. Service Context (Mandatory)
    if (!state.context.serviceLocked) {
        // 🔒 STAGE GUARD: Only extract service if we are in a resolution stage.
        // This prevents the service extraction from consuming input intended for later stages.
        if (state.stage !== "BUSINESS_RESOLUTION" &&
            state.stage !== "SERVICE_CONTEXT" &&
            state.stage !== "SERVICE_CONTEXT_WAITING") {
            return { complete: false, updates: {} };
        }

        // CHECK: Is this a reply to our question?
        if (state.context.questions.service.asked && !state.context.questions.service.answered) {
            // NON-NEGOTIABLE RULE: Treat the first valid user reply as the service.
            // No NLP. No classification. No validation.
            const finalService = instruction.trim();

            if (finalService.length > 0) {
                return {
                    complete: true, // <-- Correct Signal: Service extracted === Service complete
                    updates: {
                        context: {
                            ...state.context,
                            service: finalService,
                            serviceLocked: true,
                            questions: { ...state.context.questions, service: { asked: true, answered: true } }
                        }
                    }
                };
            }
        }

        // INITIAL CHECK: Can we extract it from the initial prompt?
        // Only if we haven't asked yet.
        const intentMatch = instruction.match(/(?:post|about|for)\s+(?:my\s+)?(.+)/i);
        if (intentMatch && intentMatch[1].length > 3 && !state.context.questions.service.asked) {
            const candidate = intentMatch[1].replace(/\b(please|instagram|create)\b/gi, "").trim();
            if (candidate.length > 3) {
                return {
                    complete: true, // <-- Correct Signal: Service extracted === Service complete
                    updates: {
                        context: {
                            ...state.context,
                            service: candidate,
                            serviceLocked: true,
                            questions: { ...state.context.questions, service: { asked: true, answered: true } }
                        }
                    }
                };
            }
        }

        // First time asking (Mandatory)
        return {
            complete: false,
            updates: {
                context: {
                    ...state.context,
                    questions: { ...state.context.questions, service: { asked: true, answered: false } }
                }
            },
            question: "What service do you want this Instagram post to focus on? (e.g., 'Laundry Service', 'Fitness Centre')"
        };
    }

    // 2. Offer Context
    if (!state.context.offerLocked) {
        if (state.context.questions.offer.asked && !state.context.questions.offer.answered) {
            const offer = instruction.trim();
            const hasOffer = !offer.match(/\b(none|no|skip|nothing|na)\b/i);

            return {
                complete: true,
                updates: {
                    context: {
                        ...state.context,
                        offer: hasOffer ? offer : null,
                        offerLocked: true,
                        questions: { ...state.context.questions, offer: { asked: true, answered: true } }
                    }
                }
            };
        }

        return {
            complete: false,
            updates: {
                context: {
                    ...state.context,
                    questions: { ...state.context.questions, offer: { asked: true, answered: false } }
                }
            },
            question: "Is there any special offer or discount you want to mention? (Reply 'None' if not)"
        };
    }

    return { complete: true, updates: {} };
}
