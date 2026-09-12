"""Command-line entry point for the MetaDrive ego extraction runner."""

from __future__ import annotations

import argparse
import sys
from collections.abc import Sequence

from metadrive_runner import (
    DEFAULT_ENV_CONFIG,
    build_env_config,
    format_snapshot,
    run_single_agent,
)
from vehicle_extract.ego import EgoSnapshot


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Run MetaDrive and inspect host-bridge ego snapshots."
    )
    parser.add_argument(
        "--headless",
        action="store_true",
        help="Disable rendering and drive the ego vehicle with IDMPolicy.",
    )
    parser.add_argument("--seed", type=int, default=21, help="Initial MetaDrive scenario seed.")
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
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    env_config = _build_env_config(args)

    def print_snapshot(snapshot: EgoSnapshot) -> None:
        episode_step = snapshot.episode_step
        if not snapshot.valid or episode_step in (None, 0) or episode_step % args.print_every == 0:
            print(format_snapshot(snapshot), flush=True)

    try:
        summary = run_single_agent(
            env_config=env_config,
            seed=args.seed,
            max_steps=None if args.max_steps == 0 else args.max_steps,
            on_snapshot=print_snapshot,
            realtime=args.realtime,
        )
    except KeyboardInterrupt:
        print("\nMetaDrive runner stopped by user.", file=sys.stderr)
        return 130
    except RuntimeError as exc:
        print(f"MetaDrive runner error: {exc}", file=sys.stderr)
        return 1

    print(
        "runner complete: "
        f"steps={summary.steps_completed} "
        f"episodes={summary.episodes_started} "
        f"snapshots={summary.snapshots_emitted} "
        f"invalid={summary.invalid_snapshots} "
        f"final_seed={summary.final_seed}"
    )
    return 1 if summary.invalid_snapshots else 0


def _build_env_config(args: argparse.Namespace) -> dict[str, object]:
    return build_env_config(
        headless=args.headless,
        overrides={"decision_repeat": args.decision_repeat},
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


if __name__ == "__main__":
    raise SystemExit(main())
