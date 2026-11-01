---
name: img-to-html
description: Converts a screenshot, mockup, or reference image into semantic, responsive HTML/CSS and, when needed, minimal JavaScript.
author: petrentinifarma
version: 1.0.0
---

# img-to-html

Use this skill whenever the user wants to transform an image into a working HTML/CSS implementation.

## When to use

- Convert a mockup or screenshot into HTML.
- Recreate a landing page or app section from an image.
- Build a responsive layout from a visual reference.
- Create a quick prototype based on a provided design.

## Goal

Produce code that is as close as possible to the provided image while keeping the result:

- semantic
- responsive
- maintainable
- usable in a browser without extra setup

## Workflow

1. Inspect the uploaded image or screenshot carefully.
2. Identify the main structure: header, hero, cards, forms, buttons, navigation, footer, etc.
3. Recreate the layout using semantic HTML elements such as `header`, `nav`, `main`, `section`, `article`, `footer`.
4. Use modern, clean CSS with spacing, borders, shadows, colors, and typography approximating the image.
5. Ensure responsiveness for mobile and desktop breakpoints.
6. Keep JavaScript minimal and only for needed interaction.
7. If the user's stack is known, match it (React, Vite, Tailwind, or plain HTML/CSS). If not, default to plain HTML/CSS unless requested.

## Output requirements

- Return a complete, runnable HTML file when possible.
- Prefer a single `index.html` with inline CSS unless the user asks for a component structure.
- If a front-end framework is requested, provide the correct component file and CSS module or class approach.
- Match the visual hierarchy and spacing from the image as closely as possible.
- Do not invent missing text unless it is clearly present in the reference or the user confirms it.
- If the image is ambiguous, state the assumption briefly before generating the code.

## Styling guidance

- Use CSS variables for colors and spacing when helpful.
- Favor modern, clean styling over overly decorative effects.
- Ensure good contrast and consistent alignment.
- Keep the implementation accessible with proper labels, headings, and focus states.
- If the design includes icons or decorative elements, use CSS shapes, inline SVG, or simple emoji only when appropriate.

## Example usage

User asks:

- "Transform this mockup into HTML"
- "Crie a página a partir desta imagem"
- "Convert this screenshot into a responsive HTML page"

Expected behavior:

- Analyze the design.
- Explain the inferred structure briefly.
- Generate the HTML and CSS code.
- Mention any important assumptions.

## Response format

Provide:

1. a short summary of the UI structure inferred from the image
2. the code
3. a concise list of assumptions or notes

## Default fallback

If the image is too small or unclear to determine structure confidently, respond with:

- what is visible
- what is uncertain
- the best first-pass implementation
- a request for a higher-resolution image or additional spec if needed

## Quality bars

The result should look close to the source reference, be production-ready, and be easy to adapt.
