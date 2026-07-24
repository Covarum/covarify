# Money Picture Guided Understanding

Money Picture explanations follow this interaction sequence:

1. Observation
2. Evidence
3. Meaning
4. Possible actions
5. Conversation

The current implementation is deterministic. Each observation rule produces a
structured explanation payload and an allowlisted set of supported question
IDs. The interface does not accept free-form questions and does not call an
external language model.

## Future conversation flow

```text
User natural-language question
→ intent mapping
→ approved supported question ID
→ deterministic answer
→ optional conversational rendering
```

Intent mapping must fail closed. If a user's question cannot be mapped with
sufficient confidence to a supported question ID for the active observation,
Covarify must say that the question is not supported by the current evidence.
It must not guess, generate a new financial calculation, or silently broaden
the observation's account or period scope.

The deterministic payload remains the source of truth for calculations,
account provenance, confidence, qualifications, and supported answers.
