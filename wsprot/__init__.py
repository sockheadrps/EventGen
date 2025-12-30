"""
wsprot - Schema-first WebSocket protocol code generator for Python.

Generate typed Pydantic v2 models, discriminated unions, and decorator-based
event handlers from declarative protocol definitions.
"""

from .schema import (
    Field,
    Event,
    Protocol,
    Direction,
)
from .registry import (
    on_event,
    EventRegistry,
    HandlerBase,
)
from .generator import ProtocolGenerator
from .dispatcher import Dispatcher, DispatchError

__version__ = "0.1.0"
__all__ = [
    "Field",
    "Event", 
    "Protocol",
    "Direction",
    "on_event",
    "EventRegistry",
    "HandlerBase",
    "ProtocolGenerator",
    "Dispatcher",
    "DispatchError",
]

