# AI Risk Generator

Describe an AI system and get a scored risk register, a 5x5 likelihood x impact matrix, and suggested mitigations.

## Run
Open `index.html` in any browser. No install or server needed.

## Files
- `index.html` - page structure and form
- `style.css` - styling (light and dark themes)
- `script.js` - risk library (`RISKS`), scoring (`assess`), rendering and export

## Customise
Edit the `RISKS` array in `script.js` to add or change risks. Each risk has a function `f(s)` that returns likelihood `l` and impact `i` (1-5), or `null` if the risk does not apply.

This is a screening aid, not legal advice.
