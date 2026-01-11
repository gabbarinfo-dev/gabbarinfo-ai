// lib/instagram/resolve-context.js


export function resolveContext(instruction, state) {
    // 1. Service Context (Mandatory)
    if (!state.context.serviceLocked) {
        
        // CHECK: Is this a reply to our question?
        if (state.context.questions.service.asked && !state.context.questions.service.answered) {
             // Relaxed extraction: Assume user is answering the question
             // Filter out only purely navigational/confirmation words
             const cleanInstruction = instruction.replace(/\b(yes|no|ok|sure|please|start|create|post|instagram|make|generate|is|about|for|my)\b/gi, "").trim();
             
             // If they typed *anything* substantial, accept it.
             if (cleanInstruction.length > 2 || instruction.length > 5) { 
                 // Use original instruction if clean is too short but instruction was long (e.g. "It is about AI")
                 const finalService = cleanInstruction.length > 2 ? cleanInstruction : instruction;
                 
                 return {
                     complete: false, // Still need offer
                     updates: {
                         context: { 
                             ...state.context, 
                             service: finalService, 
                             serviceLocked: true,
                             questions: { ...state.context.questions, service: { asked: true, answered: true } }
                         }
                     }
                 };
             } else {
                 // Invalid answer to "What service?"
                 // Don't re-ask the exact same thing if possible, but we have to.
                 return {
                     complete: false,
                     question: "I need to know the topic. What service is this post about? (e.g., 'Laundry', 'Web Design')"
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
                     complete: false,
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

