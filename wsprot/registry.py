"""
Event decorator and registry system for message handlers.

This module provides:
- @on_event decorator for registering handler methods
- EventRegistry for tracking event handlers
- HandlerBase class for inheritance-safe handler classes
"""

from collections.abc import Callable
from typing import Any, TypeVar, get_type_hints


# Attribute name used to mark methods as event handlers
_EVENT_HANDLER_ATTR = "_wsprot_event_handler"


def on_event(event_type: str) -> Callable[[Callable], Callable]:
    """
    Decorator to register a method as a handler for a specific event type.
    
    Usage:
        class MyHandler(HandlerBase):
            @on_event("chat_message")
            async def handle_chat(self, payload: ChatMessagePayload) -> None:
                ...
    
    The decorator marks the method with metadata that the registry can discover.
    Handler methods can be sync or async.
    """
    def decorator(func: Callable) -> Callable:
        # Store event type metadata on the function
        setattr(func, _EVENT_HANDLER_ATTR, event_type)
        return func
    return decorator


class EventRegistry:
    """
    Registry that tracks event handlers for a handler class.
    
    The registry is built by scanning a class for methods decorated with @on_event.
    It supports inheritance: subclass handlers override parent handlers for the
    same event type.
    """
    
    def __init__(self) -> None:
        self._handlers: dict[str, Callable] = {}
    
    def register(self, event_type: str, handler: Callable) -> None:
        """Register a handler for an event type."""
        self._handlers[event_type] = handler
    
    def get_handler(self, event_type: str) -> Callable | None:
        """Get the handler for an event type, or None if not registered."""
        return self._handlers.get(event_type)
    
    def has_handler(self, event_type: str) -> bool:
        """Check if a handler is registered for an event type."""
        return event_type in self._handlers
    
    def event_types(self) -> list[str]:
        """Get all registered event types."""
        return list(self._handlers.keys())
    
    @classmethod
    def from_class(cls, handler_class: type) -> "EventRegistry":
        """
        Build a registry by scanning a class for @on_event decorated methods.
        
        This correctly handles inheritance: methods from parent classes are
        included, but can be overridden by subclass methods.
        """
        registry = cls()
        
        # Walk the MRO in reverse so subclass methods override parent methods
        for klass in reversed(handler_class.__mro__):
            for name, method in vars(klass).items():
                if callable(method) and hasattr(method, _EVENT_HANDLER_ATTR):
                    event_type = getattr(method, _EVENT_HANDLER_ATTR)
                    registry.register(event_type, method)
        
        return registry


class HandlerBase:
    """
    Base class for Event handlers.
    
    Subclass this and use @on_event decorators to define handlers:
    
        class ChatHandler(HandlerBase):
            @on_event("chat_message")
            async def handle_message(self, payload: ChatMessagePayload) -> None:
                print(f"Got message: {payload.content}")
    
    The handler class can be subclassed for protocol extension:
    
        class ExtendedChatHandler(ChatHandler):
            @on_event("chat_message")  # Override parent handler
            async def handle_message(self, payload: ChatMessagePayload) -> None:
                await super().handle_message(payload)
                # Additional logic...
            
            @on_event("typing_indicator")  # Add new handler
            async def handle_typing(self, payload: TypingPayload) -> None:
                ...
    """
    
    _registry: EventRegistry | None = None
    
    @classmethod
    def get_registry(cls) -> EventRegistry:
        """
        Get the event registry for this handler class.
        
        The registry is lazily built and cached. Each class in the hierarchy
        gets its own registry (not shared with parent/child classes).
        """
        # Check if we have a registry cached on this exact class (not inherited)
        if "_registry" not in cls.__dict__ or cls.__dict__["_registry"] is None:
            cls._registry = EventRegistry.from_class(cls)
        return cls._registry
    
    def get_handler(self, event_type: str) -> Callable | None:
        """
        Get the bound handler method for an event type.
        
        Returns None if no handler is registered for the event type.
        """
        registry = self.get_registry()
        unbound_method = registry.get_handler(event_type)
        if unbound_method is None:
            return None
        # Bind the method to this instance
        return unbound_method.__get__(self, type(self))
    
    def handles_event(self, event_type: str) -> bool:
        """Check if this handler has a registered handler for the event type."""
        return self.get_registry().has_handler(event_type)
    
    def handled_events(self) -> list[str]:
        """Get all event types this handler can handle."""
        return self.get_registry().event_types()


# Type variable for typed handler factories
T = TypeVar("T", bound=HandlerBase)


def create_handler_class(
    name: str,
    handlers: dict[str, Callable],
    base: type[T] = HandlerBase,
) -> type[T]:
    """
    Dynamically create a handler class with the given event handlers.
    
    This is useful for programmatic handler creation:
    
        async def handle_message(self, payload):
            ...
        
        MyHandler = create_handler_class("MyHandler", {
            "chat_message": handle_message,
        })
    """
    # Mark each handler with the event type
    namespace = {}
    for event_type, handler in handlers.items():
        setattr(handler, _EVENT_HANDLER_ATTR, event_type)
        # Use a unique name for each handler in the class namespace
        handler_name = f"_handle_{event_type.replace('.', '_').replace('-', '_')}"
        namespace[handler_name] = handler
    
    return type(name, (base,), namespace)

