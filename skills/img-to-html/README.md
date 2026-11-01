# img-to-html

This skill helps convert screenshots, UI mockups, or design references into clean HTML/CSS implementations.

## Purpose

Use it when someone wants to:

- turn an image into a webpage
- recreate a landing page from a mockup
- generate a quick prototype from a screenshot
- convert a design into responsive markup

## Typical prompts

- "Turn this image into HTML"
- "Crie a versão em HTML dessa tela"
- "Transform this mockup into a responsive webpage"
- "Generate a landing page from this screenshot"

## What to do

1. Analyze the image structure and visual hierarchy.
2. Infer layout blocks such as header, nav, hero, cards, forms, and footer.
3. Generate semantic HTML with clear sectioning.
4. Add clean, responsive CSS to match colors, spacing, shadows, borders, and typography.
5. Keep JavaScript minimal unless interactivity is required.
6. If no framework is specified, default to plain HTML/CSS.

## Output style

Return a complete HTML file, or a small component structure if the user requests a framework.

Keep code clean and easy to copy-paste into a project.

## Notes

- Do not invent text that is not clearly visible in the image.
- State assumptions when the image is ambiguous.
- Prefer a polished, accessible version over an overly complex one.
