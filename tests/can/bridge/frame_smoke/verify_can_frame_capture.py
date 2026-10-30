#!/usr/bin/env python3
"""Decode the C++ smoke logger's JSONL capture with cantools and the DBC."""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

import cantools


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("capture", type=Path)
    parser.add_argument("dbc", type=Path)
    args = parser.parse_args()

    database = cantools.database.load_file(args.dbc)
    checked = 0
    seen_ids: set[int] = set()
    for line_number, line in enumerate(args.capture.read_text().splitlines(), start=1):
        if not line.strip():
            continue
        try:
            record = json.loads(line)
            frame_id = int(record["can_id"])
            dlc = int(record["dlc"])
            payload = bytes.fromhex(record["data"])
            expected = record["expected"]
            message = database.get_message_by_frame_id(frame_id)
        except (KeyError, TypeError, ValueError, json.JSONDecodeError) as error:
            raise SystemExit(f"capture line {line_number} is malformed: {error}") from error

        if message is None:
            raise SystemExit(f"capture line {line_number}: unknown CAN ID 0x{frame_id:X}")
        if dlc != message.length or len(payload) != dlc:
            raise SystemExit(
                f"capture line {line_number}: DLC {dlc} does not match {message.name}"
            )
        decoded = message.decode(payload, decode_choices=False)
        for signal_name, expected_value in expected.items():
            actual_value = decoded[signal_name]
            if isinstance(expected_value, (int, bool)):
                matches = actual_value == expected_value
            else:
                matches = math.isclose(
                    float(actual_value), float(expected_value), rel_tol=0.0, abs_tol=1e-8
                )
            if not matches:
                raise SystemExit(
                    f"capture line {line_number}: {message.name}.{signal_name} "
                    f"decoded as {actual_value!r}, expected {expected_value!r}"
                )
        for signal in message.signals:
            if "Reserved" in signal.name and decoded[signal.name] != 0:
                raise SystemExit(
                    f"capture line {line_number}: reserved signal "
                    f"{message.name}.{signal.name} is nonzero"
                )
        seen_ids.add(frame_id)
        checked += 1

    expected_ids = {0x100, 0x200, 0x300}
    if not checked or seen_ids != expected_ids:
        raise SystemExit(
            f"capture must include frames 0x100, 0x200, and 0x300; "
            f"checked {checked} frames with IDs {sorted(seen_ids)}"
        )
    print(
        f"cantools DBC cross-check passed for {checked} frames "
        "(0x100, 0x200, 0x300); expected signals match and reserved signals are zero."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
