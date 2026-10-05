# Draw

A small freeform whiteboard (like Freeform or FigJam). Pen tool with size and color, light gray board with dots, pan and zoom. Everything is saved in the browser (IndexedDB). No backend.

## Develop
```
npm install
npm run dev      # dev server
npm test         # unit tests
npm run build    # production build in dist/
```

## Controls
- Draw: mouse, finger, or Apple Pencil.
- Pan: scroll, or Space + drag, or middle mouse.
- Zoom: Ctrl + scroll (or trackpad pinch).
- Undo / redo: Cmd/Ctrl+Z, Shift+Cmd/Ctrl+Z. Pen size: `[` and `]`.

## Add to the iPhone / iPad home screen
Host the `dist/` folder over HTTPS, open it in Safari, tap Share, then "Add to Home Screen".
