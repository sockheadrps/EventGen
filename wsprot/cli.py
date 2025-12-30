"""
Command-line interface for wsprot code generation.

Usage:
    python -m wsprot generate protocol.yaml -o output.py
    python -m wsprot generate protocol.yaml  # prints to stdout
"""

import argparse
import sys
from pathlib import Path

from .schema import Protocol


def cmd_generate(args: argparse.Namespace) -> int:
    """Generate code from a protocol definition."""
    input_path = Path(args.input)
    
    if not input_path.exists():
        print(f"Error: File not found: {input_path}", file=sys.stderr)
        return 1
    
    try:
        protocol = Protocol.from_yaml_file(str(input_path))
    except Exception as e:
        print(f"Error parsing protocol: {e}", file=sys.stderr)
        return 1
    
    from .generator import ProtocolGenerator
    generator = ProtocolGenerator(protocol)
    
    if args.output:
        output_path = Path(args.output)
        if output_path.suffix == ".py":
            # Single file output
            output_path.write_text(generator.generate())
            print(f"Generated: {output_path}")
        else:
            # Directory output (multiple files)
            generator.write_all(str(output_path))
    else:
        print(generator.generate())
    
    return 0


def cmd_validate(args: argparse.Namespace) -> int:
    """Validate a protocol definition."""
    input_path = Path(args.input)
    
    if not input_path.exists():
        print(f"Error: File not found: {input_path}", file=sys.stderr)
        return 1
    
    try:
        protocol = Protocol.from_yaml_file(str(input_path))
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1
    
    print(f"Protocol: {protocol.name}")
    if protocol.version:
        print(f"Version: {protocol.version}")
    print(f"Events: {len(protocol.events)}")
    print(f"  Client -> Server: {len(protocol.client_to_server_events())}")
    print(f"  Server -> Client: {len(protocol.server_to_client_events())}")
    
    if args.verbose:
        print("\nEvents:")
        for event in protocol.events:
            print(f"  - {event.name} ({event.direction.value})")
            for field in event.fields:
                opt = "" if field.required else " (optional)"
                print(f"      {field.name}: {field.type}{opt}")
    
    print("\nProtocol is valid.")
    return 0


def main(argv: list[str] | None = None) -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        prog="wsprot",
        description="Schema-first Event specification and code generator",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)
    
    # generate command
    gen_parser = subparsers.add_parser(
        "generate",
        help="Generate Python code from a protocol definition",
    )
    gen_parser.add_argument(
        "input",
        help="Path to the protocol definition (YAML)",
    )
    gen_parser.add_argument(
        "-o", "--output",
        help="Output path (directory or .py file)",
    )
    gen_parser.add_argument(
        "--split",
        action="store_true",
        help="Split into server/ and client/ directories",
    )
    gen_parser.set_defaults(func=cmd_generate)
    
    # validate command
    val_parser = subparsers.add_parser(
        "validate",
        help="Validate a protocol definition",
    )
    val_parser.add_argument(
        "input",
        help="Path to the protocol definition (YAML)",
    )
    val_parser.add_argument(
        "-v", "--verbose",
        action="store_true",
        help="Show detailed event information",
    )
    val_parser.set_defaults(func=cmd_validate)
    
    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())

