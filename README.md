# Speira (web)

A digital spirograph you can draw with: choose a toothed ring and a wheel, put the pen in one of the wheel's holes and
roll it, just like the classic toy. This is the web version and the proving ground for
[Speira for iPad](https://github.com/Sammy-Tej/speira), which shares the same gear maths and file format.

Plain JavaScript, HTML and CSS, with no framework and no build step beyond inlining the icons.

## What it does

- Two round rings, 18 wheels, and bars, shapes and a fixed wheel to roll round
- Roll by hand (with momentum) or let it draw by itself; lift the pen; undo and redo
- Eight pen styles (ballpoint, gel, fineliner, felt-tip, highlighter, pencil, metallic, glitter), any colour, rainbow ink
- Layers, paper colours and textures, snapping pieces by their edges and centres
- **Unwind**: Speira composes and draws patterns by itself, forever; a six-letter session code replays the same patterns
- A Sketchbook of drawings saved in the browser, `.speira` files, and PNG/SVG export

## Run it

Serve the folder with any static server, for example:

```bash
python3 -m http.server 8740
```

then open http://localhost:8740. After editing `index.src.html`, rebuild `index.html` with `python3 tools/build.py`.

## Status

A personal project in progress (October 2026), built with AI-assisted development (Claude Code). The design, product
decisions and testing are mine.

Icons: [Phosphor Icons](https://phosphoricons.com) (MIT). Font: Cinzel (SIL Open Font License).

© 2026 Sameer Teja Avvaru. All rights reserved. The code is shared to be read, not reused.
