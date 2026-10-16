# AI Log

## Five effective prompts

1. "Inspect Task 1's `/query` Pydantic contract and build a strongly typed client without duplicating Task 1 code."
2. "Create exactly 50 realistic support emails with this category distribution, then add an automated count assertion."
3. "Implement the 20-consecutive-approval rule with explicit resets for edits, rejection, and risk."
4. "Compare Meeting A and Meeting C and classify changes as Added, Modified, Removed, or Out-of-Scope with source quotes."
5. "Run focused validation after each edit and repair only the failing local behavior."

## One rejected AI output

The first attempted Task 2 response followed the active Azure debug-generation mode and refused to create the requested application, redirecting to a debug-plan workflow. That output was rejected because the user had explicitly asked for source files for a new capstone task, while debug generation is limited to VS Code launch configuration. The fix was to inspect the actual Task 1 contract, create `task2-inbox-agent` directly, and validate it with its 20-test suite and strict TypeScript build.
