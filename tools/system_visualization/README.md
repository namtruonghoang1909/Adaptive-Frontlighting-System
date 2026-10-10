# Code Graph

The Code graph shows implemented classes and their interactions. Selected entry
functions complete the path through the simulation loop and browser display.
Files and folders are not graph nodes. Layer panels group nodes by source folder;
the CAN bridge, Dashboard, and firmware panels show that their runtime classes
are still planned.

## Open The Viewer

From the repository root:

```bash
bash tools/system_visualization/start_code_graph.sh
```

Open the printed URL (default
`http://127.0.0.1:8000/tools/system_visualization/`). Pass a port number to use
another port. Press Ctrl+C to stop the server. Python 3 is the only runtime
requirement.

## Explore

Click a circle to highlight its direct upstream and downstream connections.
The right panel explains the class or function, lists those connections, and
links to its source. Clicking a class or function with members also expands
smaller circles for its methods or fields; click again to collapse them. Parent
circles have 1.5 times the radius of child circles. Children retain their
parent's color tone. Interaction arrows point in call or data direction;
dashed arrows carry data, and dotted lines attach members. Arrow captions are
shown for direct connections after selecting a node; unrelated nodes and
arrows dim.
Parent circles follow the implemented paths within each layer: runner entry,
controls and scene storage; ego and surrounding extraction into the
combined scene; then the browser server and drawing steps. Their positions are
intentionally loose so arrows and expanded members have room. Search and layer
filters bring matching nodes toward the top while keeping their relative order.

The graph opens at a readable zoom near its first class. Search by class or
component name, or filter by layer/folder. Drag the graph background to pan,
scroll or use +/− to zoom, and choose **Fit** for a whole-map overview. Use
**Reset map** to clear search, filter, focus, and expanded members and return
to the readable view. Press Escape to clear focus.

## Follow A Functionality

The **Functionalities** section on the right lists six implemented paths:
runner startup, ego extraction, surrounding extraction, scene
publication, browser display, and manual driving control. Select one to expand
the required members, focus the start of its route, and light up numbered
action arrows.
The action list shows the function or class at each end, the values passed,
and a source link. Select an action to focus its starting node and nearby
connection; pan to follow longer paths. Select the same
functionality or **Clear** to remove its highlights. The ordinary graph remains
available for clicking, expanding, searching, filtering, zooming, and panning.
Selecting a path temporarily clears search and layer filters so all its nodes
are visible; clearing the path restores those controls.

Parent nodes and expanded members have wider spacing so their connecting
arrows remain readable.

## Maintenance And Verification

`graph-data.js` contains curated classes, members, implemented interactions,
layer metadata, and parent positions. `functionality-data.js` contains the
separate, ordered implemented paths. `build_index.py` generates `code-index.js`
for source links and validation. The generated inventory is not displayed as
graph nodes.
After implementing or fixing code, review both curated models against the
change, regenerate the inventory, and run these checks in the same task. See
the [agent maintenance rules](../../agents/code_visualize.md) for what to
update when calls, arguments, behavior, or implementation status change.

```bash
python3 tools/system_visualization/build_index.py
python3 tools/system_visualization/build_index.py --check
node tools/system_visualization/validate.mjs
node --check tools/system_visualization/graph-data.js
node --check tools/system_visualization/code-index.js
node --check tools/system_visualization/viewer.js
node --check tools/system_visualization/functionality-data.js
node --check tools/system_visualization/functionality-overlay.js
node --check tools/system_visualization/validate.mjs
```
