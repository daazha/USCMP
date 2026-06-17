# Frontend Rendering Rules

1. MUST use AntV G6 with WebGL renderer
2. Nodes > 200: auto clustering
3. Nodes > 500: reject rendering with message to narrow scope
4. Double-click node: lazy load depth=1 only
5. Low confidence edges: dashed or low opacity
6. Click edge: open EvidenceDrawer
7. Time slice change: re-request graph API
8. Color mapping: financial=green, social=blue, political=red, evidence=gray, event=yellow
9. Node shapes: Person=circle, Organization=rounded rect, PoliticalEntity=diamond, Event=hexagon, Claim=dot, SourceDocument=document icon
