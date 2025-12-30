"""
Validated dispatcher for WebSocket message routing.

This module provides a Dispatcher class that:
- Parses incoming JSON messages
- Validates them against a discriminated union type
- Routes them to the appropriate handler method
"""

import asyncio
import json
from collections.abc import Awaitable, Callable
from typing import Annotated, Any, TypeVar, Union, get_args, get_origin

from pydantic import BaseModel, TypeAdapter, ValidationError

from .registry import HandlerBase


class DispatchError(Exception):
    """Base exception for dispatch errors."""
    pass


class ParseError(DispatchError):
    """Raised when JSON parsing fails."""
    pass


class ValidationError_(DispatchError):
    """Raised when message validation fails."""
    
    def __init__(self, message: str, errors: list[dict[str, Any]] | None = None):
        super().__init__(message)
        self.errors = errors or []


class UnknownEventError(DispatchError):
    """Raised when no handler is registered for an event type."""
    
    def __init__(self, event_type: str):
        super().__init__(f"No handler registered for event type: {event_type}")
        self.event_type = event_type


class NoHandlerError(DispatchError):
    """Raised when the handler doesn't have a method for the event."""
    
    def __init__(self, event_type: str):
        super().__init__(f"Handler has no method for event type: {event_type}")
        self.event_type = event_type


T = TypeVar("T", bound=BaseModel)


class Dispatcher:
    """
    Dispatches validated WebSocket messages to handler methods.
    
    Usage:
        # Create dispatcher with a discriminated union type and handler
        dispatcher = Dispatcher(
            message_type=ClientMessage,  # Discriminated union
            handler=MyHandler(),
            discriminator="type",
        )
        
        # Dispatch incoming messages
        async def on_message(websocket, data: str):
            try:
                await dispatcher.dispatch(data)
            except DispatchError as e:
                await websocket.send_json({"error": str(e)})
    
    The message_type should be a Pydantic discriminated union like:
    
        ClientMessage = Annotated[
            ChatMessage | JoinRoom | LeaveRoom,
            Field(discriminator="type")
        ]
    """
    
    def __init__(
        self,
        message_type: type[T],
        handler: HandlerBase,
        discriminator: str = "type",
        on_error: Callable[[DispatchError], Awaitable[None] | None] | None = None,
    ):
        """
        Initialize the dispatcher.
        
        Args:
            message_type: The Pydantic discriminated union type for incoming messages
            handler: The handler instance with @on_event decorated methods
            discriminator: The field name used as discriminator (default: "type")
            on_error: Optional error callback (sync or async)
        """
        self.message_type = message_type
        self.handler = handler
        self.discriminator = discriminator
        self.on_error = on_error
        
        # Create a TypeAdapter for validation (handles Annotated unions properly)
        self._type_adapter = TypeAdapter(message_type)
        
        # Build a mapping from discriminator values to model types
        self._type_map = self._build_type_map()
    
    def _build_type_map(self) -> dict[str, type[BaseModel]]:
        """Build a mapping from discriminator values to model types."""
        type_map: dict[str, type[BaseModel]] = {}
        
        # Get the union members
        origin = get_origin(self.message_type)
        if origin is Union:
            members = get_args(self.message_type)
        else:
            # It might be an Annotated type
            args = get_args(self.message_type)
            if args:
                inner = args[0]
                if get_origin(inner) is Union:
                    members = get_args(inner)
                else:
                    members = (self.message_type,)
            else:
                members = (self.message_type,)
        
        for member in members:
            if not isinstance(member, type) or not issubclass(member, BaseModel):
                continue
            
            # Get the discriminator value from model_fields
            if self.discriminator in member.model_fields:
                field_info = member.model_fields[self.discriminator]
                # Check for Literal type default
                if field_info.default is not None:
                    type_map[field_info.default] = member
                elif field_info.annotation is not None:
                    # Try to extract from Literal type
                    lit_args = get_args(field_info.annotation)
                    if lit_args:
                        type_map[lit_args[0]] = member
        
        return type_map
    
    def parse(self, data: str | bytes | dict[str, Any]) -> BaseModel:
        """
        Parse and validate an incoming message.
        
        Args:
            data: JSON string, bytes, or already-parsed dict
        
        Returns:
            A validated Pydantic model instance
        
        Raises:
            ParseError: If JSON parsing fails
            ValidationError_: If validation fails
        """
        # Parse JSON if needed
        if isinstance(data, (str, bytes)):
            try:
                parsed = json.loads(data)
            except json.JSONDecodeError as e:
                raise ParseError(f"Invalid JSON: {e}")
        else:
            parsed = data
        
        if not isinstance(parsed, dict):
            raise ParseError("Message must be a JSON object")
        
        # Validate against the message type using TypeAdapter
        try:
            return self._type_adapter.validate_python(parsed)
        except ValidationError as e:
            raise ValidationError_(
                f"Validation failed: {e.error_count()} error(s)",
                errors=e.errors(),
            )
    
    def get_event_type(self, message: BaseModel) -> str:
        """Extract the event type from a validated message."""
        return getattr(message, self.discriminator)
    
    async def dispatch(self, data: str | bytes | dict[str, Any]) -> Any:
        """
        Parse, validate, and dispatch a message to the appropriate handler.
        
        Args:
            data: The incoming message (JSON string, bytes, or dict)
        
        Returns:
            The return value of the handler method
        
        Raises:
            ParseError: If JSON parsing fails
            ValidationError_: If validation fails
            NoHandlerError: If no handler is registered for the event type
        """
        try:
            # Parse and validate
            message = self.parse(data)
            
            # Get event type
            event_type = self.get_event_type(message)
            
            # Get handler method
            handler_method = self.handler.get_handler(event_type)
            if handler_method is None:
                raise NoHandlerError(event_type)
            
            # Call handler (sync or async)
            result = handler_method(message)
            if asyncio.iscoroutine(result):
                result = await result
            
            return result
            
        except DispatchError as e:
            if self.on_error is not None:
                error_result = self.on_error(e)
                if asyncio.iscoroutine(error_result):
                    await error_result
            raise
    
    def dispatch_sync(self, data: str | bytes | dict[str, Any]) -> Any:
        """
        Synchronous version of dispatch for non-async handlers.
        
        Only use this if all your handlers are synchronous.
        """
        # Parse and validate
        message = self.parse(data)
        
        # Get event type
        event_type = self.get_event_type(message)
        
        # Get handler method
        handler_method = self.handler.get_handler(event_type)
        if handler_method is None:
            raise NoHandlerError(event_type)
        
        # Call handler
        return handler_method(message)


class MultiDispatcher:
    """
    Dispatcher that routes to different handlers based on event type prefixes or patterns.
    
    Useful for modular protocols where different subsystems handle different event groups.
    """
    
    def __init__(
        self,
        message_type: type[T],
        discriminator: str = "type",
    ):
        self.message_type = message_type
        self.discriminator = discriminator
        self._type_adapter = TypeAdapter(message_type)
        self._handlers: list[tuple[Callable[[str], bool], HandlerBase]] = []
        self._default_handler: HandlerBase | None = None
    
    def register(
        self,
        handler: HandlerBase,
        prefix: str | None = None,
        matcher: Callable[[str], bool] | None = None,
    ) -> "MultiDispatcher":
        """
        Register a handler for events matching a prefix or custom matcher.
        
        Args:
            handler: The handler instance
            prefix: Event type prefix to match (e.g., "chat." matches "chat.message")
            matcher: Custom function that returns True for matching event types
        
        Returns:
            self for chaining
        """
        if prefix is not None:
            matcher = lambda et, p=prefix: et.startswith(p)
        elif matcher is None:
            raise ValueError("Must provide either prefix or matcher")
        
        self._handlers.append((matcher, handler))
        return self
    
    def set_default(self, handler: HandlerBase) -> "MultiDispatcher":
        """Set a default handler for unmatched events."""
        self._default_handler = handler
        return self
    
    def _find_handler(self, event_type: str) -> HandlerBase | None:
        """Find the handler for an event type."""
        for matcher, handler in self._handlers:
            if matcher(event_type) and handler.handles_event(event_type):
                return handler
        
        if self._default_handler and self._default_handler.handles_event(event_type):
            return self._default_handler
        
        return None
    
    async def dispatch(self, data: str | bytes | dict[str, Any]) -> Any:
        """Dispatch a message to the appropriate handler."""
        # Parse JSON if needed
        if isinstance(data, (str, bytes)):
            try:
                parsed = json.loads(data)
            except json.JSONDecodeError as e:
                raise ParseError(f"Invalid JSON: {e}")
        else:
            parsed = data
        
        if not isinstance(parsed, dict):
            raise ParseError("Message must be a JSON object")
        
        # Get event type from raw data first
        event_type = parsed.get(self.discriminator)
        if event_type is None:
            raise ValidationError_(f"Missing discriminator field: {self.discriminator}")
        
        # Find handler
        handler = self._find_handler(event_type)
        if handler is None:
            raise NoHandlerError(event_type)
        
        # Validate
        try:
            message = self._type_adapter.validate_python(parsed)
        except ValidationError as e:
            raise ValidationError_(
                f"Validation failed: {e.error_count()} error(s)",
                errors=e.errors(),
            )
        
        # Dispatch to handler
        handler_method = handler.get_handler(event_type)
        if handler_method is None:
            raise NoHandlerError(event_type)
        
        result = handler_method(message)
        if asyncio.iscoroutine(result):
            result = await result
        
        return result

