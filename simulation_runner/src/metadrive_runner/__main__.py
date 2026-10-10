"""Command-line entry point for the MetaDrive scene extraction runner."""

from __future__ import annotations

import argparse
import sys
from collections.abc import Sequence
from typing import Any

from metadrive_runner import (
    DEFAULT_ENV_CONFIG,
    build_env_config,
    format_snapshot,
    run_single_agent,
)
from object_extraction.ego import EgoSnapshot


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Run MetaDrive and publish ego and surrounding snapshots."
    )
    parser.add_argument(
        "--headless",
        action="store_true",
        help="Disable rendering and drive the ego vehicle with IDMPolicy.",
    )
    parser.add_argument("--seed", type=int, default=21, help="Initial MetaDrive scenario seed.")
    parser.add_argument(
        "--map", type=_positive_int, default=int(DEFAULT_ENV_CONFIG["map"]),
        help="MetaDrive map block count (default: 4).",
    )
    parser.add_argument(
        "--traffic-density", type=_unit_float,
        default=float(DEFAULT_ENV_CONFIG["traffic_density"]),
        help="MetaDrive traffic density from 0 to 1 (default: 0.1).",
    )
    parser.add_argument(
        "--max-steps",
        type=_non_negative_int,
        default=0,
        help="Total env.step calls across episodes; 0 runs until interrupted.",
    )
    parser.add_argument(
        "--print-every",
        type=_positive_int,
        default=10,
        help="Print every N simulation steps; reset and invalid snapshots always print.",
    )
    parser.add_argument(
        "--decision-repeat",
        type=_positive_int,
        default=int(DEFAULT_ENV_CONFIG["decision_repeat"]),
        help="Physics ticks per environment step; lower values render and extract more often.",
    )
    parser.add_argument(
        "--realtime",
        action=argparse.BooleanOptionalAction,
        default=None,
        help="Pace env.step to simulated time; defaults on when rendered and off when headless.",
    )
    parser.add_argument(
        "--surrounding-radius-m",
        type=_non_negative_float,
        default=100.0,
        help="Object-center collection radius in meters (default: 100).",
    )
    parser.add_argument(
        "--scene-display",
        "--visualize",
        dest="scene_display",
        action="store_true",
        help="Serve the development scene display in a background thread.",
    )
    parser.add_argument(
        "--scene-display-port",
        type=_tcp_port,
        default=8765,
        help="Local scene display TCP port (default: 8765).",
    )
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    env_config = _build_env_config(args)
    display_server: Any | None = None
    summary = None
    exit_code = 0

    def print_snapshot(snapshot: EgoSnapshot) -> None:
        episode_step = snapshot.episode_step
        if not snapshot.valid or episode_step in (None, 0) or episode_step % args.print_every == 0:
            print(format_snapshot(snapshot), flush=True)

    try:
        if args.scene_display:
            from scene_display import SceneDisplayServer

            display_server = SceneDisplayServer(port=args.scene_display_port)
            display_server.start()
            print(f"scene display: {display_server.url}", flush=True)
        summary = run_single_agent(
            env_config=env_config,
            seed=args.seed,
            max_steps=None if args.max_steps == 0 else args.max_steps,
            on_snapshot=print_snapshot,
            surrounding_radius_m=args.surrounding_radius_m,
            realtime=args.realtime,
        )
    except KeyboardInterrupt:
        print("\nMetaDrive runner stopped by user.", file=sys.stderr)
        exit_code = 130
    except RuntimeError as exc:
        print(f"MetaDrive runner error: {exc}", file=sys.stderr)
        exit_code = 1
    finally:
        if display_server is not None:
            try:
                display_server.stop()
            except RuntimeError as exc:
                print(f"Scene display shutdown error: {exc}", file=sys.stderr)
                if exit_code == 0:
                    exit_code = 1

    if summary is not None:
        print(
            "runner complete: "
            f"steps={summary.steps_completed} "
            f"episodes={summary.episodes_started} "
            f"snapshots={summary.snapshots_emitted} "
            f"invalid={summary.invalid_snapshots} "
            f"final_seed={summary.final_seed}"
        )
        if summary.invalid_snapshots and exit_code == 0:
            exit_code = 1
    return exit_code


def _build_env_config(args: argparse.Namespace) -> dict[str, object]:
    return build_env_config(
        headless=args.headless,
        overrides={
            "decision_repeat": args.decision_repeat,
            "map": args.map,
            "traffic_density": args.traffic_density,
        },
    )


def _positive_int(value: str) -> int:
    parsed = int(value)
    if parsed <= 0:
        raise argparse.ArgumentTypeError("must be greater than zero")
    return parsed


def _non_negative_int(value: str) -> int:
    parsed = int(value)
    if parsed < 0:
        raise argparse.ArgumentTypeError("must be zero or greater")
    return parsed


def _non_negative_float(value: str) -> float:
    import math

    parsed = float(value)
    if not math.isfinite(parsed) or parsed < 0:
        raise argparse.ArgumentTypeError("must be a finite number zero or greater")
    return parsed


def _unit_float(value: str) -> float:
    parsed = _non_negative_float(value)
    if parsed > 1:
        raise argparse.ArgumentTypeError("must be from 0 through 1")
    return parsed


def _tcp_port(value: str) -> int:
    parsed = int(value)
    if not 1 <= parsed <= 65535:
        raise argparse.ArgumentTypeError("must be from 1 through 65535")
    return parsed


if __name__ == "__main__":
    raise SystemExit(main())
