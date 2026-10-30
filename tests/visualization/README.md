# System Visualization Tests

Each folder checks one browser visualization area:

| Folder | What it tests |
|---|---|
| [`beam_model/`](beam_model/) | Beam geometry and mapping logical sectors to matrix columns/pixels. |
| [`beam_segments/`](beam_segments/) | High- and low-beam page interactions and rendered segment behavior. |
| [`can_messages/`](can_messages/) | CAN message reference page content and interaction behavior. |
| [`code_timestamp/`](code_timestamp/) | Displaying the latest source-update timestamp in visualization pages. |

Run the complete visualization suite with
`bash tests/scripts/test_visualization.sh`; pass a folder name to run only that
module, such as `bash tests/scripts/test_visualization.sh beam_model`. The full
suite also checks JavaScript syntax and the generated Code graph inventory.
