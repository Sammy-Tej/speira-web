# Speira: IP and market research (summary)

Research done in Claude chat on 15/10/26, at Sam's request. **It is research, not legal advice**, and many items are marked
unverified. The full report is in that chat; this file keeps the findings and the actions that affect the apps.

## Findings
- **Name "Speira": low–medium risk.**
  - No SPEIRA mark was found in classes 9, 28, 41 or 42.
  - The main owner of SPEIRA is Speira GmbH, a large German aluminium company: WIPO IR 1660884, US serial 79346339 (metals/class 40), plus 2021 EU filings.
  - Near names to ask an attorney about:
    - SPIRA, US Reg. 3833466, classes 9/42 (field-ticketing software);
    - SPIRA, US serial 99498291, class 41 (pending);
    - SPIRA, US Reg. 5706241, class 28;
    - Brother's "Artspira" app;
    - the "SPIERA" fitness app.
  - Not checked (Sam to run): UK IPO, EUIPO, TMview, WIPO, CN/JP/KR/IN/CA/AU registers, Companies House, domains, social handles.
  - Backups if needed (all unchecked): Trochoa, Gearloom, Epicyra, Rollwork, Cycloria.
- **"Spirograph" is a live Hasbro trademark.**
  - US Reg. 858225, class 28, renewed 2018; licensed to PlayMonster, which launched an electronic version in 2025.
  - No class 9 registration was found (unverified).
  - Apple Guidelines 2.3.7 and 5.2.1 forbid trademarked terms in the name, subtitle and keywords.
- **Patents: low risk on what was found.**
  - The Denys Fisher patents (GB1024438, US3230624/RE26341, GB1154653, DE3162729D1) have all expired.
  - The maths is free to use.
  - There is no freedom-to-operate opinion for the newer features: pieces from freehand outlines, tooth-synced haptics, rolling with the TV remote.
- **Copyright:**
  - Users own their drawings.
  - The classic tooth counts are facts.
  - Phosphor (MIT) and Cinzel (OFL) need their licence texts shown in the app.
  - Our tooth clicks are generated in code, so there are no sound licences to track.
- **Market:**
  - Competitors: Spirograph Maker (free with ads, 4.4★ from 88 ratings), SpiroDesigner ($2.99), Spirograph Drawing ($9.99, SVG export), Inspirograph (web), plus ambient Apple TV apps with no gear drawing.
  - Things nobody else has: hand-rolling with momentum and haptics, pieces from a drawn outline, gear drawing on Apple TV, plotter-ready SVG, recipes, realistic pens, video export, no ads and no subscription.
  - The common complaints about competitors are confusing interfaces and no vector export.
- **Kids' mode:**
  - Apple's Kids Category (Guideline 1.3) requires a parental gate before any purchase, and no third-party analytics or ads.
  - Joining the category is a one-way commitment, so make kids' mode a mode inside the normal app.

## Actions for the apps
1. Never use "Spirograph" in the app name, subtitle, keywords, screenshots or icon. Descriptive words are fine: spiral art, gear art, geometric drawing, hypotrochoid, epitrochoid, mandala, pattern maker.
2. Change the default piece colours away from the toy's blue rings and pink wheels. Keep "Classic" as one choice among several.
3. Name pieces in our own way (we already use tooth counts), never with Spirograph set names or part numbers.
4. Add an Acknowledgements screen with the Phosphor MIT and Cinzel OFL texts, and bundle OFL.txt with the font.
5. Add terms of use that say users own their drawings.
6. Haptics: use only Apple's public APIs (UICanvasFeedbackGenerator, sensoryFeedback), with a visual fallback. The Pencil only buzzes for events the Pencil itself started.
7. Kids' mode: a parental gate in front of purchases, no third-party software kits, no outside links.
8. Pencil-drawn custom pieces may be patentable. Don't show the feature publicly before asking a patent attorney. The web app stays on Sam's Mac, which helps.
9. Before filing: run the registry searches, get a trademark clearance search from an attorney, then file SPEIRA in the UK in classes 9 and 41 (maybe 42 and 28) and extend it abroad through Madrid.
