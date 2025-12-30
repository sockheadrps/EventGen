# Alpine.js Components

This directory contains modular Alpine.js components for the Protocol Builder application.

## Architecture

The application is now componentized for better maintainability and separation of concerns:

```
components/
├── types.js          # Custom Types component logic
├── types.html        # Custom Types component template
├── events.js         # Events component logic
├── events.html       # Events component template
└── README.md         # This file
```

## Component Communication

Components communicate with the main application through custom events:

### Types Component
- **Emits**: `types-updated` with `{ types: {...} }`
- **Receives**: Type data through Alpine binding

### Events Component
- **Emits**: `events-updated` with `{ side: 'client|server', events: [...] }`
- **Emits**: `event-detail-requested` with `{ side, index, event }`
- **Receives**: Configuration through Alpine binding (`side`, `title`, `description`, `events`)

## Usage

Components are loaded dynamically using `fetch()` in the main HTML:

```html
<!-- Load component template -->
<div x-init="$el.innerHTML = await fetch('components/types.html').then(r => r.text())"></div>

<!-- Initialize component with data -->
<div x-data="customTypes()"></div>
```

## Benefits

- **Modular**: Each component is self-contained
- **Maintainable**: Easier to modify individual features
- **Reusable**: Components can be reused or extended
- **Testable**: Each component can be tested independently
- **Scalable**: Easy to add new components

## Adding New Components

1. Create `{component}.js` with Alpine.data() definition
2. Create `{component}.html` with template
3. Include in main `index.html`
4. Add event handlers in main component
5. Update this README
