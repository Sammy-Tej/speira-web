// Speira's Help. KEEP THIS UP TO DATE: whenever a feature lands or changes, update the section it belongs to
// (or add one). It is plain data on purpose, so the iPad, Mac and Apple TV apps can carry the same words.
// Each section: id, title, a one-line summary, and items of [heading, text]. Text may use <b>, <i> and <kbd>.
const HELP = [
  {
    id: 'start', title: 'Getting started', summary: 'Draw your first pattern in ten seconds.',
    items: [
      ['Roll the wheel', 'Drag anywhere on the paper in circles and the wheel rolls round the ring, pen and all. Flick it and it keeps going for a moment (Momentum).'],
      ['Or let it draw', 'Press <b>Draw</b> (or <kbd>Space</kbd>) and Speira rolls the wheel for you. Press again to pause; <b>Continue</b> carries on.'],
      ['Finish a pattern', 'Press <kbd>F</kbd> to complete the pattern in one go.'],
      ['Start another pass', '<b>New layer</b> (or <kbd>Enter</kbd>) keeps what you drew and starts a fresh pass with the same pieces. Change the pen colour or the wheel for something new on top.'],
      ['Changed your mind?', 'Undo with <kbd>⌘</kbd><kbd>Z</kbd>, redo with <kbd>⇧</kbd><kbd>⌘</kbd><kbd>Z</kbd>, or the arrows in the top bar.']
    ]
  },
  {
    id: 'pieces', title: 'Pieces', summary: 'Rings, bars, shapes and wheels, measured in teeth like a real kit.',
    items: [
      ['What the numbers mean', 'Every number on a piece is its <b>number of teeth</b>. A ring marked 96 / 150 has 96 teeth on its inside edge and 150 round the outside. The teeth on the piece and the wheel decide how many petals you get and how many trips round it takes before the pattern joins up.'],
      ['Round rings', 'Two rings, 96 / 150 and 105 / 144. Choose <b>Inside</b> to roll the wheel inside the ring, or <b>Outside</b> to roll round it.'],
      ['Bars', 'Bar 84 and Bar 108 are long pieces with rounded ends. The wheel rolls along both sides and round both ends, so you get ribbons and borders. Bars only have teeth on the outside. Turn them with <b>Angle</b>.'],
      ['Shapes', 'Oval, Triangle and Square have two toothed edges, like the rings. Inside, only wheels small enough to get round the tightest curve fit; the others are greyed out, and Speira swaps a wheel that is too big for one that fits. Turn shapes with <b>Angle</b>.'],
      ['Your own shapes', 'Under <b>Your shapes</b>, press <b>Draw a shape…</b> and draw the outline of a new piece with your finger, Apple Pencil or mouse. Speira smooths it and works out its teeth from its length. <b>Smoothness</b> irons out wobbles (higher is smoother); <b>Size</b> makes the piece bigger or smaller, which changes how many teeth it has. A faint purple pattern shows what it makes.'],
      ['When a shape is refused', 'A real wheel has to be able to follow the outline, so Speira refuses a point too sharp for teeth, a dent tighter than the smallest wheel (24 teeth) can get into, or a line that crosses itself. The trouble spots are circled in red. Smoothing it, making it bigger or redrawing that part usually fixes it.'],
      ['Inner edge', 'If the corners are round enough, tick <b>Toothed inner edge too</b> to give your shape a second edge on the inside, 24 teeth shorter, so the wheel can roll inside it like the round rings. Without one, your shape is rolled round the outside only.'],
      ['Keeping your shapes', 'Saved shapes go in <b>My shapes</b> in the Sketchbook and appear under Your shapes in Pieces. Touch one to put it on the paper. In the Sketchbook you can rename, duplicate or delete them. A drawing keeps its own copy of the shape, so it still opens if the shape is deleted.'],
      ['Fixed wheel', 'Pin a wheel of any size to the paper and roll another wheel round it. Pick the pinned wheel\'s size under <b>Fixed wheel</b>.'],
      ['Wheels', 'Eighteen wheels from 24 to 84 teeth. Bigger wheels make fewer, larger loops.'],
      ['Pen hole', 'Holes near the edge of the wheel make big, loopy patterns; holes near the middle make gentle waves. You can also click a hole on the wheel itself.'],
      ['Start shift and Auto shift', '<b>Start shift</b> starts the pattern a few teeth further round, so the next pass sits between the last one. <b>Auto shift</b> does that for you every time you start a new layer.'],
      ['Kit size', 'Makes every piece bigger or smaller together. It changes how big the pattern is, not its shape.'],
      ['Moving the piece', '<b>Move ring</b> (or hold <kbd>Alt</kbd> and drag) moves the piece on the paper; <b>Centre ring</b> puts it back in the middle.'],
      ['Petals and laps', 'Under Draw you can see how many petals the pattern will have and after how many trips round it closes.'],
      ['Two sets at once', 'Press <b>Second set</b> at the top of the paper and choose which kind: round ring, bar, oval, triangle, square or fixed wheel. It goes beside the first set in a new pen colour. The sets may overlap.'],
      ['Choosing a set', 'Touch a set\'s pieces, its name at the top, or press <kbd>S</kbd>. The chosen set is lit up and looks solid; the panel and Repeat change only that set. The other set looks faded.'],
      ['Drawing with two sets', 'Each set has its own Draw button (▶) at the top, so they can draw one at a time or both together. The Draw button in the panel draws the chosen set.'],
      ['Back to one set', 'The ✕ next to a set takes its pieces off the paper. Anything it drew stays as a layer.']
    ]
  },
  {
    id: 'drawing', title: 'Drawing', summary: 'Rolling by hand, by keyboard and by itself.',
    items: [
      ['Speed', 'How fast the wheel turns when Speira draws for you.'],
      ['Repeat', 'Press <b>Repeat</b> to draw the same pattern several times, each one a few teeth further round. Choose how many, how many teeth apart (<b>Spread evenly</b> spaces them evenly round the pattern), and the colour: the same, fading to another colour, or stepping through a rainbow. Speira draws them one after another at your drawing speed: <kbd>Space</kbd> pauses, <kbd>F</kbd> finishes the rest at once, and one <kbd>⌘</kbd><kbd>Z</kbd> takes them all off.'],
      ['Momentum', 'When on, a flick keeps the wheel rolling and slowing down on its own.'],
      ['One-way', 'The wheel only ever rolls forwards, like a real pen that can\'t go back.'],
      ['Lift the pen', 'Tick <b>Lift the pen</b> (or press <kbd>L</kbd>) to roll the wheel somewhere new without drawing. The pen tip looks hollow while it is lifted. Put it down and drawing carries on from there.'],
      ['Roll with the keyboard', '<kbd>→</kbd> rolls one tooth forward, <kbd>←</kbd> one tooth back. Hold the key to keep rolling; add <kbd>⇧</kbd> for ten teeth at a time.'],
      ['Tooth clicks', 'A soft click for every tooth, like the real kit. Set the volume or mute them in the Draw card.'],
      ['Preview', 'The dashed-circle button (or <kbd>G</kbd>) shows a faint outline of the whole pattern before you draw it. Lit means on; crossed out means off.'],
      ['Pieces', 'The eye button (or <kbd>H</kbd>) shows or hides the ring and wheel so you can see the drawing clearly. They hide themselves when a pattern is finished and come back when you start again.']
    ]
  },
  {
    id: 'pens', title: 'Pens and colour', summary: 'Eight pens, rainbow ink and a warning when ink won\'t show.',
    items: [
      ['Pen types', '<b>Ballpoint</b>, <b>Gel</b> (with a little shine), <b>Fineliner</b>, <b>Felt-tip</b> (darker where lines cross), <b>Highlighter</b>, <b>Metallic</b> (shimmers as the line turns), <b>Glitter</b> and <b>Pencil</b>.'],
      ['Colour', 'Pick a swatch or any colour with Custom colour. Changing the pen after you have paused starts a new pass right where the wheel is, like swapping pens without moving the pieces.'],
      ['Rainbow ink', 'The colour shifts along the line, starting from your pen colour.'],
      ['Thickness and opacity', 'Make the line bolder or finer, more solid or more see-through.'],
      ['Invisible ink warning', 'If the ink would barely show on your paper, a warning appears in the Pen section with a suggested ink that will show. Click it to switch.']
    ]
  },
  {
    id: 'paper', title: 'Paper', summary: 'Sizes, colours and textures.',
    items: [
      ['New canvas', '<b>New canvas</b> in the Sketchbook (or <kbd>N</kbd>) opens a sheet to set up a drawing before you start: its name, its size (a ready-made size, or any size in millimetres, centimetres, inches or pixels), the print resolution, the paper colour or a see-through background, the colour profile and the video settings. It remembers your choices for next time.'],
      ['Size', 'Square, A5, A4, A3, US Letter, phone and desktop wallpapers, Instagram sizes, or a custom size in millimetres, centimetres, inches or pixels. Pieces stay their real size, so a bigger sheet has more room.'],
      ['Colour profile', '<b>sRGB</b> is safest for the web, other apps and most printers. <b>Display P3</b> gives richer reds, greens and oranges on Apple screens; PNG and JPG pictures carry the profile with them. Display P3 only appears on screens that can show it, like Speira on a Mac or an iPad Air; elsewhere sRGB is used.'],
      ['Print resolution', 'Choose the DPI for printing; it sets how many pixels a PNG or JPG has.'],
      ['Turn the sheet', 'Swap portrait and landscape. Drawings stay centred when the sheet changes.'],
      ['Colour and texture', 'White, cream, kraft, black, navy, slate or any colour, plus grain, watercolour or kraft texture.']
    ]
  },
  {
    id: 'layers', title: 'Layers and recipes', summary: 'Every pass is a layer you can change later.',
    items: [
      ['Edit a layer', 'In Layers, press the pencil on a layer to change its pen, colour, thickness, opacity or rainbow ink. The other layers fade while you edit so you can see it.'],
      ['Reorder', 'Drag a layer by its handle to put it above or below the others.'],
      ['Hide and delete', 'The eye hides a layer; the bin deletes it. <b>Clear paper</b> removes everything (you can undo it).'],
      ['Draw it again', 'In a layer\'s editor, <b>Draw it again</b> sets up your next pass exactly like that layer.'],
      ['Recipes', '<b>Copy recipe</b> puts a layer\'s exact pieces and pen on the clipboard as a line of text and a code, to keep or share. <b>Paste recipe</b> (or <kbd>⌘</kbd><kbd>V</kbd> anywhere) sets you up from one.']
    ]
  },
  {
    id: 'view', title: 'View, rulers and guides', summary: 'Zoom, turn the paper, and line things up exactly.',
    items: [
      ['The View menu', 'Press <b>View</b> at the top for everything below. Your choices are remembered next time. Recipes can\'t carry your own shapes yet; share a .speira file instead.'],
      ['Zoom', 'Pinch on a trackpad or screen, use <kbd>⌘</kbd><kbd>+</kbd> and <kbd>⌘</kbd><kbd>−</kbd>, or the buttons at the top left of the paper. <kbd>⌘</kbd><kbd>0</kbd> fits the whole sheet; <kbd>⌘</kbd><kbd>1</kbd> shows it at real size.'],
      ['Move around', 'Scroll with two fingers, or drag with the middle mouse button. <b>Auto-centre</b> puts the paper back in the middle when the window changes size.'],
      ['Turn the paper', 'Twist two fingers on a trackpad or screen, or use the turn buttons in View. It clicks straight when close to upright or sideways. <b>Straighten</b> puts it back.'],
      ['Rulers', '<kbd>⌃</kbd><kbd>⌘</kbd><kbd>R</kbd> shows rulers along the top and left, in your paper\'s units (mm, inches or pixels). They hide while the paper is turned.'],
      ['Guides', 'Drag out of a ruler to make a guide. Drag a guide to move it, or back onto the ruler to remove it. View can also add centre guides, type a guide at an exact place, or clear them all. <kbd>⌘</kbd><kbd>;</kbd> shows or hides them; <kbd>⌥</kbd><kbd>⌘</kbd><kbd>;</kbd> locks them so they can\'t be moved by accident.'],
      ['Saved guides', 'Type a name under <b>Saved guides</b> and press Save to keep the guides you have now. Pick it from the list on any drawing to bring them back.'],
      ['Snapping', 'When you move a ring, its pattern snaps the way it does in Pixelmator Pro and Affinity: its left edge, centre and right edge (and its top, middle and bottom) click to the paper\'s edges and centre, guides, and anything else that is showing (grid, thirds, margins). The ring stays where you grabbed it, so it never jumps. <kbd>⇧</kbd><kbd>⌘</kbd><kbd>;</kbd> turns snapping off. Hold <kbd>⌃</kbd> while dragging to move freely just this once.'],
      ['Smart guides', 'Patterns snap to each other too: to the edges and middle of every other pattern on the paper, and to the centres of the other pieces. A pink line shows what it lined up with, so patterns can sit side by side, touch, or line up neatly.'],
            ['Overlays', 'A grid (<kbd>⌘</kbd><kbd>\'</kbd>, with a choice of spacing), centre lines, a rule-of-thirds grid and print margins. They only show on screen and never in exports. <b>Overlays</b> hides them all at once.'],
      ['Info bar', '<kbd>⌃</kbd><kbd>⌘</kbd><kbd>I</kbd> shows a strip with the paper size, zoom, angle and where the pointer is.'],
      ['Clear the way', '<kbd>⌃</kbd><kbd>⌘</kbd><kbd>P</kbd> hides the side panel. <kbd>⌃</kbd><kbd>H</kbd> hides everything except the paper; <kbd>Esc</kbd> brings it all back.'],
      ['Drawing info', '<b>Drawing info…</b> lists the name, paper, picture size, layers and pieces of the drawing.'],
      ['Full screen', 'The corners button (or <kbd>⌃</kbd><kbd>⌘</kbd><kbd>F</kbd>) shows just the paper. <kbd>Esc</kbd> comes back.']
    ]
  },
  {
    id: 'book', title: 'Sketchbook and saving', summary: 'Keep as many drawings as you like, in folders.',
    items: [
      ['Save', 'Press <b>Save</b> (or <kbd>⌘</kbd><kbd>S</kbd>) to keep the drawing in your Sketchbook. A dot next to its name at the top means it has changes you haven\'t saved yet.'],
      ['Names', 'New drawings are called <b>Canvas</b> and the date, like Canvas 14/10/26; a second one that day becomes Canvas 14/10/26 2. Click the name at the top to rename it.'],
      ['The Sketchbook', 'Press <b>Sketchbook</b> (or <kbd>⌘</kbd><kbd>O</kbd>) to see all your drawings. Click one to open it. If the drawing you\'re leaving has unsaved changes, Speira asks whether to save it first.'],
      ['A fresh sheet', '<b>New canvas</b> in the Sketchbook (or <kbd>N</kbd>) asks how the new drawing should be set up (see Paper), then starts it blank with the pieces in the middle.'],
      ['Folders', '<b>My drawings</b> is where drawings go to start with. <b>My shapes</b> holds the pieces you draw yourself (see Pieces). Make your own with <b>New folder</b>, and move drawings with the <b>⋯</b> button on each one.'],
      ['Rename, duplicate, delete', 'The <b>⋯</b> button on a drawing (or right-click) can rename it, make a copy, move it or delete it.'],
      ['Recently deleted', 'Deleted drawings wait in <b>Recently deleted</b> for 30 days, so you can put them back. After that they are gone for good, or straight away if you press Delete now or Empty.'],
      ['Speira files', '<b>Save as file</b> makes a small .speira file of a drawing, to move it to another computer or keep as a backup. <b>Open file</b>, or dragging a .speira file onto Speira, adds it to your Sketchbook and opens it.'],
      ['Where drawings are kept', 'On the web, your Sketchbook lives in this browser on this device. Clearing the browser\'s website data deletes it, so save .speira files of drawings you love now and then. The iPad and Mac apps will keep everything in iCloud.']
    ]
  },
  {
    id: 'export', title: 'Exporting pictures and videos', summary: 'PNG, JPG, SVG and video.',
    items: [
      ['Export', 'Press <b>Export</b> (or <kbd>⌘</kbd><kbd>E</kbd>) and pick a format. <kbd>⇧</kbd><kbd>⌘</kbd><kbd>E</kbd> exports again with the same settings.'],
      ['PNG and JPG', 'Pictures at your paper\'s size. PNG can have a see-through background; JPG is smaller.'],
      ['SVG', '<b>With pen effects</b> looks like the screen. <b>Plain lines</b> gives one clean line per layer, best for design apps, pen plotters and cutting machines.'],
      ['Video', 'A video of your drawing making itself, every layer in order, 6 to 30 seconds long, optionally with the pieces turning. Choose 1080p, 2K or 4K and the quality (Low, Good, Studio or Lossless, which is the best the browser can record). HEVC makes smaller files where the browser offers it (Safari). These are saved with the drawing. It records in real time, so keep the tab in front.']
    ]
  },
  {
    id: 'watch', title: 'Unwind', summary: 'Sit back while Speira draws by itself.',
    items: [
      ['Start', 'Press <b>Unwind</b> (or <kbd>W</kbd>). Speira fills the screen and composes patterns on its own, forever, on black. Every visit starts with a fresh sheet.'],
      ['Bring your drawing', 'If there is a drawing on your canvas, Unwind asks first: <b>Start fresh</b>, or <b>Use my drawing</b>. With your drawing, Speira adds its layers on top; your own layers stay put and never fade.'],
      ['Paper and colours', 'Unwind draws on black, which suits TVs best. <b>Paper</b> → <b>My paper</b> uses your drawing\'s paper colour instead. Colour moods include three from the Speira palette (Kaleidoscope, Jewels, Earth) and <b>My pens</b>, the colours in your drawing. If a colour would barely show on the paper, Watch makes it a little darker or lighter. Watch always chooses its own pen types.'],
      ['Your drawing\'s look', 'When you bring your drawing along, Unwind switches to your paper and your pens for that visit. Your saved choices come back next time.'],
      ['Layers come and go', 'Up to six of Speira\'s layers build up (fewer if you choose), then the oldest fades as each new one starts.'],
      ['Two at once', '<b>Two at once</b> (or <kbd>T</kbd>) draws two patterns side by side. They never overlap.'],
      ['Controls', 'Move the mouse to see them: speed, colour mood, rainbow ink, show the pieces, two at once, layers on screen, click volume, pause, next layer and leave.'],
      ['Keys', '<kbd>Space</kbd> pause · <kbd>→</kbd> next layer · <kbd>R</kbd> rainbow · <kbd>P</kbd> pieces · <kbd>T</kbd> two at once · <kbd>K</kbd> keep · <kbd>M</kbd> mute · <kbd>Esc</kbd> leave.'],
      ['Roll it yourself', 'Drag in circles to turn the wheel; let go and Speira carries on.'],
      ['Leaving', 'If Speira drew anything you haven\'t kept, leaving asks what to do: add it to your canvas as new layers (<kbd>⌘</kbd><kbd>Z</kbd> takes them off again), save it as a new drawing in your Sketchbook, or leave without saving. <b>Keep watching</b> takes you back.'],
      ['Keeping when you brought your drawing', 'You choose: <b>Add them to my drawing</b> puts Speira\'s layers on your drawing, where you saw them; <b>Save as a copy</b> leaves your drawing as it was and saves a copy with Speira\'s layers on top.'],
      ['Keep', '<b>Keep</b> (or <kbd>K</kbd>) asks the same question without leaving, so you can keep a moment and carry on watching.'],
      ['Session code', 'Every session has a six-letter code. Type a code and press Enter to replay that session with the same colour setting.'],
      ['Bedtime', '<b>Sleep</b> fades the picture and the clicks to black after 30, 60 or 90 minutes, then rests. Nobody is there to ask, so it quietly saves what Speira drew in your Sketchbook: as a new drawing, or as a copy of yours if you brought it along. Your canvas is never changed.']
    ]
  },
  {
    id: 'look', title: 'Light and dark', summary: 'Choose how Speira looks.',
    items: [
      ['Piece colours', 'The pieces are tinted plastic you can see through. <b>Mint</b> (green rings, amber wheels) is Speira\'s own; there are also three from the Speira palette (aqua and copper, violet and chartreuse, teal and gold), Classic blue and pink, Violet, Smoke and Clear. Choose under Paper.'],
      ['Theme', 'The sun and moon at the top switch between light and dark. Speira starts with your device\'s setting and then remembers your choice. Your paper colour never changes with it.'],
      ['Apple Pencil', 'While the Pencil is on or near the screen, your resting hand is ignored.'],
      ['Bigger targets', 'Buttons and sliders grow on touch screens so they are easy to hit.']
    ]
  },
  {
    id: 'keys', title: 'All keyboard shortcuts', summary: 'Everything in one list.',
    items: [
      ['Drawing', '<kbd>Space</kbd> draw / pause · <kbd>Enter</kbd> new layer · <kbd>F</kbd> finish · <kbd>←</kbd><kbd>→</kbd> roll a tooth (<kbd>⇧</kbd> for ten) · <kbd>L</kbd> lift the pen'],
      ['Pieces and pen', '<kbd>[</kbd> <kbd>]</kbd> previous / next pen hole · <kbd>,</kbd> <kbd>.</kbd> start shift back / forward · <kbd>H</kbd> pieces · <kbd>G</kbd> preview · <kbd>S</kbd> switch between two sets'],
      ['View', '<kbd>⌘</kbd><kbd>+</kbd> / <kbd>⌘</kbd><kbd>−</kbd> zoom · <kbd>⌘</kbd><kbd>0</kbd> fit · <kbd>⌘</kbd><kbd>1</kbd> actual size · <kbd>⌃</kbd><kbd>⌘</kbd><kbd>F</kbd> full screen'],
      ['Rulers and guides', '<kbd>⌃</kbd><kbd>⌘</kbd><kbd>R</kbd> rulers · <kbd>⌘</kbd><kbd>;</kbd> guides · <kbd>⌥</kbd><kbd>⌘</kbd><kbd>;</kbd> lock guides · <kbd>⇧</kbd><kbd>⌘</kbd><kbd>;</kbd> snapping · <kbd>⌃</kbd> while dragging: no snapping · <kbd>⌘</kbd><kbd>\'</kbd> grid'],
      ['Panels', '<kbd>⌃</kbd><kbd>⌘</kbd><kbd>I</kbd> info bar · <kbd>⌃</kbd><kbd>⌘</kbd><kbd>P</kbd> hide panel · <kbd>⌃</kbd><kbd>H</kbd> hide everything (<kbd>Esc</kbd> to bring back)'],
      ['Files', '<kbd>⌘</kbd><kbd>S</kbd> save · <kbd>⌘</kbd><kbd>O</kbd> Sketchbook · <kbd>N</kbd> new canvas · <kbd>⌘</kbd><kbd>E</kbd> export · <kbd>⇧</kbd><kbd>⌘</kbd><kbd>E</kbd> export again · <kbd>⌘</kbd><kbd>Z</kbd> undo · <kbd>⇧</kbd><kbd>⌘</kbd><kbd>Z</kbd> redo · <kbd>⌘</kbd><kbd>V</kbd> paste a recipe'],
      ['Elsewhere', '<kbd>W</kbd> Unwind (<kbd>T</kbd> two at once inside it) · <kbd>?</kbd> this Help']
    ]
  }
];
if (typeof module !== 'undefined') module.exports = { HELP };
