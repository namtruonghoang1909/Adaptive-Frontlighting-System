"""Managed local FastAPI/Uvicorn server for live scene visualization."""

from __future__ import annotations

import math
import socket
import time
from collections.abc import Callable
from pathlib import Path
from threading import Lock, Thread
from typing import Any

from object_extraction import SceneSnapshot
from scene_display.normalization import scene_display_payload

SceneProvider = Callable[[], SceneSnapshot | None]


class SceneDisplayError(RuntimeError):
    """Raised when the optional scene display cannot start or stop cleanly."""


def create_app(
    *,
    snapshot_provider: SceneProvider | None = None,
    stale_after_s: float = 0.5,
    clock: Callable[[], float] = time.monotonic,
) -> Any:
    """Create the optional FastAPI application with a latest-scene endpoint."""
    try:
        from fastapi import FastAPI
        from fastapi.responses import FileResponse, JSONResponse
        from fastapi.staticfiles import StaticFiles
    except ImportError as exc:
        raise SceneDisplayError(
            "Scene display dependencies are unavailable. Install the simulation "
            "runner with the visual dependency group: pip install -e "
            "'./simulation_runner[visual]'"
        ) from exc

    stale_after = scene_display_payload(None, stale_after_s=stale_after_s)["stale_after_s"]
    provider = snapshot_provider or _latest_scene
    assets = Path(__file__).with_name("assets")
    app = FastAPI(title="AFS Scene Display", docs_url=None, redoc_url=None)
    app.mount("/assets", StaticFiles(directory=assets), name="assets")

    @app.get("/", include_in_schema=False)
    def index() -> Any:
        return FileResponse(assets / "index.html")

    @app.get("/api/health", include_in_schema=False)
    def health() -> Any:
        return JSONResponse(
            {"status": "ok", "mode": "live"},
            headers={"Cache-Control": "no-store"},
        )

    @app.get("/api/scene", include_in_schema=False)
    def latest_scene() -> Any:
        try:
            payload = scene_display_payload(
                provider(),
                stale_after_s=stale_after,
                now_monotonic_s=clock(),
            )
        except Exception as exc:
            payload = {
                "schema_version": 2,
                "mode": "live",
                "state": "error",
                "age_s": None,
                "stale_after_s": stale_after,
                "scene": None,
                "error": f"{type(exc).__name__}: {exc}",
            }
        return JSONResponse(payload, headers={"Cache-Control": "no-store"})

    return app


class SceneDisplayServer:
    """Run the local scene display on a managed background thread."""

    def __init__(
        self,
        *,
        host: str = "127.0.0.1",
        port: int = 8765,
        stale_after_s: float = 0.5,
        snapshot_provider: SceneProvider | None = None,
        startup_timeout_s: float = 5.0,
    ) -> None:
        if not isinstance(port, int) or isinstance(port, bool) or not 0 <= port <= 65535:
            raise ValueError("port must be an integer from 0 through 65535")
        try:
            timeout_s = float(startup_timeout_s)
        except (TypeError, ValueError) as exc:
            raise ValueError("startup_timeout_s must be finite and greater than zero") from exc
        if not math.isfinite(timeout_s) or timeout_s <= 0:
            raise ValueError("startup_timeout_s must be greater than zero")

        self.host = host
        self.port = port
        self.stale_after_s = scene_display_payload(
            None, stale_after_s=stale_after_s
        )["stale_after_s"]
        self.snapshot_provider = snapshot_provider
        self.startup_timeout_s = timeout_s
        self._state_lock = Lock()
        self._server: Any | None = None
        self._thread: Thread | None = None
        self._listener: socket.socket | None = None
        self._thread_error: BaseException | None = None

    @property
    def url(self) -> str:
        return f"http://{self.host}:{self.port}"

    @property
    def running(self) -> bool:
        with self._state_lock:
            return bool(self._thread is not None and self._thread.is_alive())

    def start(self) -> None:
        """Bind the port and wait until Uvicorn has started serving."""
        with self._state_lock:
            if self._thread is not None:
                raise SceneDisplayError("scene display is already started")

        try:
            import uvicorn
        except ImportError as exc:
            raise SceneDisplayError(
                "Scene display dependencies are unavailable. Install the simulation "
                "runner with the visual dependency group: pip install -e "
                "'./simulation_runner[visual]'"
            ) from exc

        app = create_app(
            snapshot_provider=self.snapshot_provider,
            stale_after_s=self.stale_after_s,
        )
        listener: socket.socket | None = None
        try:
            listener = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            listener.bind((self.host, self.port))
            listener.listen(128)
        except OSError as exc:
            if listener is not None:
                listener.close()
            raise SceneDisplayError(
                f"Could not start scene display on {self.host}:{self.port}: {exc}"
            ) from exc

        self.port = int(listener.getsockname()[1])
        config = uvicorn.Config(
            app,
            host=self.host,
            port=self.port,
            access_log=False,
            log_level="warning",
            lifespan="off",
        )
        server = uvicorn.Server(config)
        server.install_signal_handlers = lambda: None

        def serve() -> None:
            try:
                server.run(sockets=[listener])
            except BaseException as exc:
                self._thread_error = exc

        thread = Thread(target=serve, name="afs-scene-display", daemon=True)
        with self._state_lock:
            self._server = server
            self._listener = listener
            self._thread = thread
            self._thread_error = None
        thread.start()

        deadline = time.monotonic() + self.startup_timeout_s
        while not server.started:
            if not thread.is_alive():
                error = self._thread_error
                self.stop()
                detail = f": {error}" if error is not None else ""
                raise SceneDisplayError(f"Scene display stopped during startup{detail}")
            if time.monotonic() >= deadline:
                self.stop()
                raise SceneDisplayError("Timed out while starting scene display")
            time.sleep(0.01)

    def stop(self) -> None:
        """Request shutdown and join the managed server thread."""
        with self._state_lock:
            server = self._server
            thread = self._thread
            listener = self._listener
        if thread is None:
            return

        if server is not None:
            server.should_exit = True
        thread.join(timeout=5.0)
        if listener is not None:
            try:
                listener.close()
            except OSError:
                pass
        if thread.is_alive():
            raise SceneDisplayError("Timed out while stopping scene display")

        with self._state_lock:
            self._server = None
            self._thread = None
            self._listener = None

    def __enter__(self) -> SceneDisplayServer:
        self.start()
        return self

    def __exit__(self, exc_type: object, exc: object, traceback: object) -> None:
        self.stop()


def _latest_scene() -> SceneSnapshot | None:
    from metadrive_runner import get_scene_snapshot

    return get_scene_snapshot()
