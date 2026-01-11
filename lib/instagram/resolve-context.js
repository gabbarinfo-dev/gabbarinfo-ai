// lib/instagram/resolve-context.js

export function resolveContext(instruction, state) {
    let context = { ...state.context };
    
    // Filter out common flow words to see if there's real content
    const cleanInstruction = instruction.replace(/\b(yes|no|ok|sure|please|start|create|post|instagram)\b/gi, "").trim();
    
    // Extract URL
    const urlMatch = instruction.match(/https?:\/\/[^\s]+/);
    if (urlMatch) {
        context.website = urlMatch[0];
    }

    // Append to intent if it carries meaning
    if (cleanInstruction.length > 0) {
        if (!context.rawIntent) context.rawIntent = instruction; // Keep original for context
        else context.rawIntent += " " + instruction;
    }

    // Minimal requirement: A website OR some descriptive text (> 5 chars)
    const hasWebsite = !!context.website;
    const hasDescription = (context.rawIntent && context.rawIntent.length > 5);
    
    if (!hasWebsite && !hasDescription) {
         return {
            complete: false,
            context,
            question: "What should this post be about? Share a website link, describe your service, or tell me the topic."
        };
    }

    return {
        complete: true,
        context
    };
}
