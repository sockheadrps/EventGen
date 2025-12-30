"""
Core schema representation for Event protocol definitions.

This module provides the building blocks for definition typed events:
- Field: A single field in an event payload
- Event: A complete event with name, direction, and payload schema
- Protocol: A collection of events forming a complete protocol
"""

from dataclasses import dataclass, field as dataclass_field
from enum import Enum
from typing import Any, Literal


class Direction(Enum):
    """Direction of message flow."""

    CLIENT_TO_SERVER = "client_to_server"
    SERVER_TO_CLIENT = "server_to_client"
    BIDIRECTIONAL = "bidirectional"


# Mapping of simple type names to Python type hints
TYPE_MAP: dict[str, str] = {
    "str": "str",
    "string": "str",
    "int": "int",
    "integer": "int",
    "float": "float",
    "number": "float",
    "bool": "bool",
    "boolean": "bool",
    "any": "Any",
    "none": "None",
    "null": "None",
}


@dataclass
class Field:
    """
    A single field in an event payload.

    Attributes:
        name: Field name (will be used as the Python attribute name)
        type: Type annotation as a string (e.g., "str", "int", "list[str]")
        required: Whether the field is required (default True)
        default: Default value if not required (None means no default)
        description: Optional description for documentation
        alias: Optional JSON alias (e.g., "from" -> "sender" since "from" is reserved)
    """

    name: str
    type: str
    required: bool = True
    default: Any = None
    description: str | None = None
    alias: str | None = None

    def python_type(self, custom_types: dict[str, list[str]] | None = None) -> str:
        """Convert the type string to a Python type annotation."""
        # Handle custom types first
        if custom_types and self.type in custom_types:
            base_type = f"{self.type}Enum"
        # Handle simple types
        elif self.type.lower() in TYPE_MAP:
            base_type = TYPE_MAP[self.type.lower()]
        else:
            base_type = self.type

        # Wrap in Optional if not required and no default
        if not self.required and self.default is None:
            return f"{base_type} | None"
        return base_type

    def default_repr(self) -> str | None:
        """Get the repr of the default value for code generation."""
        if self.required and self.default is None:
            return None
        if self.default is None:
            return "None"
        if isinstance(self.default, str):
            return repr(self.default)
        return repr(self.default)


@dataclass
class Event:
    """
    An Event definition.


    Attributes:
        name: Event type name (used as discriminator value)
        direction: Message flow direction
        fields: List of payload fields
        description: Optional description for documentation
        class_name: Optional override for the generated class name
        handler_group: Optional group name for handler organization (e.g., "chat", "presence")
    """

    name: str
    direction: Direction
    fields: list[Field] = dataclass_field(default_factory=list)
    description: str | None = None
    class_name: str | None = None
    handler_group: str | None = None
    feature: str | None = None  # Feature name if part of a feature module

    def get_class_name(self) -> str:
        """Get the Python class name for this event."""
        if self.class_name:
            return self.class_name
        # Convert event name to PascalCase
        # "user_joined" -> "UserJoined"
        # "chat.message" -> "ChatMessage"
        parts = self.name.replace(".", "_").replace("-", "_").split("_")
        return "".join(part.capitalize() for part in parts)

    def is_client_to_server(self) -> bool:
        """Check if this event can be sent from client to server."""
        return self.direction in (Direction.CLIENT_TO_SERVER, Direction.BIDIRECTIONAL)

    def is_server_to_client(self) -> bool:
        """Check if this event can be sent from server to client."""
        return self.direction in (Direction.SERVER_TO_CLIENT, Direction.BIDIRECTIONAL)


@dataclass
class Protocol:
    """
    A complete Event protocol definition.

    Attributes:
        name: Protocol name (used for generated module/class names)
        version: Optional version string
        events: List of event definitions
        description: Optional description for documentation
        types: Custom type definitions (dict of type_name -> list of allowed values)
    """

    name: str
    events: list[Event] = dataclass_field(default_factory=list)
    version: str | None = None
    description: str | None = None
    types: dict[str, list[str]] = dataclass_field(default_factory=dict)
    features: dict[str, dict] = dataclass_field(default_factory=dict)  # Raw features data

    def client_to_server_events(self) -> list[Event]:
        """Get all events that can be sent from client to server."""
        return [e for e in self.events if e.is_client_to_server()]

    def server_to_client_events(self) -> list[Event]:
        """Get all events that can be sent from server to client."""
        return [e for e in self.events if e.is_server_to_client()]

    def add_event(
        self,
        name: str,
        direction: Direction | str,
        fields: list[Field] | None = None,
        description: str | None = None,
        class_name: str | None = None,
    ) -> "Protocol":
        """
        Add an event to the protocol (builder pattern).

        Returns self for chaining.
        """
        if isinstance(direction, str):
            direction = Direction(direction)

        self.events.append(
            Event(
                name=name,
                direction=direction,
                fields=fields or [],
                description=description,
                class_name=class_name,
            )
        )
        return self

    @classmethod
    def _parse_fields(cls, fields_data: list[dict]) -> list[Field]:
        """Parse field definitions from dict."""
        return [
            Field(
                name=f["name"],
                type=f["type"],
                required=f.get("required", True),
                default=f.get("default"),
                description=f.get("description"),
                alias=f.get("alias"),
            )
            for f in fields_data
        ]

    @classmethod
    def _parse_events(
        cls, events_data: list[dict], direction: Direction
    ) -> list[Event]:
        """Parse event definitions from dict with given direction."""
        events = []
        for event_data in events_data:
            fields = cls._parse_fields(event_data.get("fields", []))
            events.append(
                Event(
                    name=event_data["name"],
                    direction=direction,
                    fields=fields,
                    description=event_data.get("description"),
                    class_name=event_data.get("class_name"),
                    handler_group=event_data.get("handler_group"),
                )
            )
        return events

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "Protocol":
        """
        Create a Protocol from a dictionary (e.g., parsed YAML/JSON).

        Supports two formats:

        1. Unified (events with direction field):
            events:
              - name: join_room
                direction: client_to_server

        2. Split (separate client/server sections):
            client:
              - name: join_room
            server:
              - name: room_joined
        """
        events = []

        # Check for split format (client/server sections)
        if "client" in data or "server" in data:
            if "client" in data:
                events.extend(
                    cls._parse_events(data["client"], Direction.CLIENT_TO_SERVER)
                )
            if "server" in data:
                events.extend(
                    cls._parse_events(data["server"], Direction.SERVER_TO_CLIENT)
                )
        # Unified format (events with direction)
        elif "events" in data:
            for event_data in data["events"]:
                fields = cls._parse_fields(event_data.get("fields", []))
                events.append(
                    Event(
                        name=event_data["name"],
                        direction=Direction(event_data["direction"]),
                        fields=fields,
                        description=event_data.get("description"),
                        class_name=event_data.get("class_name"),
                        handler_group=event_data.get("handler_group"),
                    )
                )

        # Check for features block
        features_data = data.get("features", {})
        for feature_name, feature_content in features_data.items():
            if "client" in feature_content:
                for event_data in feature_content["client"]:
                    fields = cls._parse_fields(event_data.get("fields", []))
                    # Prefix event name with feature
                    prefixed_name = f"{feature_name.lower()}.{event_data['name']}"
                    events.append(
                        Event(
                            name=prefixed_name,
                            direction=Direction.CLIENT_TO_SERVER,
                            fields=fields,
                            description=event_data.get("description"),
                            class_name=event_data.get("class_name"),
                            handler_group=event_data.get("handler_group", feature_name.lower()),
                            feature=feature_name,
                        )
                    )
            if "server" in feature_content:
                for event_data in feature_content["server"]:
                    fields = cls._parse_fields(event_data.get("fields", []))
                    prefixed_name = f"{feature_name.lower()}.{event_data['name']}"
                    events.append(
                        Event(
                            name=prefixed_name,
                            direction=Direction.SERVER_TO_CLIENT,
                            fields=fields,
                            description=event_data.get("description"),
                            class_name=event_data.get("class_name"),
                            handler_group=event_data.get("handler_group", feature_name.lower()),
                            feature=feature_name,
                        )
                    )

        return cls(
            name=data["name"],
            events=events,
            version=data.get("version"),
            description=data.get("description"),
            types=data.get("types", {}),
            features=features_data,
        )

    @classmethod
    def from_yaml(cls, yaml_content: str) -> "Protocol":
        """Create a Protocol from YAML content."""
        import yaml

        data = yaml.safe_load(yaml_content)
        return cls.from_dict(data)

    @classmethod
    def from_yaml_file(cls, path: str) -> "Protocol":
        """Create a Protocol from a YAML file."""
        with open(path, "r") as f:
            return cls.from_yaml(f.read())
