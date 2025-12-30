/**
 * YAML Generator Module
 * Handles YAML and JSON generation for the Protocol Builder
 */

const YamlGenerator = {
    /**
     * Generate YAML string from protocol object
     */
    /**
     * Generate YAML string from protocol object
     */
    generateYAML(protocol) {
        let yaml = `name: ${protocol.name || 'Unnamed'}\n`;

        if (protocol.version) {
            yaml += `version: '${protocol.version}'\n`;
        }

        if (protocol.description) {
            yaml += `description: |\n  ${protocol.description.replace(/\n/g, '\n  ')}\n`;
        }

        // Add custom types
        if (Object.keys(protocol.types).length > 0) {
            yaml += '\ntypes:\n';
            Object.entries(protocol.types).forEach(([typeName, values]) => {
                yaml += `  ${typeName}:\n`;
                values.forEach((value) => {
                    yaml += `    - ${value}\n`;
                });
            });
        }

        yaml += '\n';

        // Add Features
        if (protocol.features && Object.keys(protocol.features).length > 0) {
            yaml += 'features:\n';
            Object.entries(protocol.features).forEach(([featureName, featureData]) => {
                yaml += `  ${featureName}:\n`;

                ['client', 'server'].forEach((side) => {
                    if (!featureData[side] || featureData[side].length === 0) return;

                    yaml += `    ${side}:\n`;
                    featureData[side].forEach((event) => {
                        yaml += this._generateEventYAML(event, 6);
                    });
                });
            });
            yaml += '\n';
        }

        // Add default/root events
        ['client', 'server'].forEach((side) => {
            if (protocol[side].length === 0) return;

            yaml += `${side}:\n`;

            protocol[side].forEach((event) => {
                yaml += this._generateEventYAML(event, 2);
            });
            yaml += '\n';
        });

        return yaml.trim();
    },

    _generateEventYAML(event, indentLevel) {
        const indent = ' '.repeat(indentLevel);
        const fieldIndent = ' '.repeat(indentLevel + 2);
        const propIndent = ' '.repeat(indentLevel + 4);

        let yaml = `${indent}- name: ${event.name}\n`;

        if (event.handler_group) {
            yaml += `${indent}  handler_group: ${event.handler_group}\n`;
        }

        if (event.description) {
            yaml += `${indent}  description: ${event.description}\n`;
        }

        if (event.fields && event.fields.length > 0) {
            yaml += `${indent}  fields:\n`;

            event.fields.forEach((field) => {
                yaml += `${fieldIndent}- name: ${field.name}\n`;
                yaml += `${propIndent}type: ${field.type}\n`;

                if (!field.required) {
                    yaml += `${propIndent}required: false\n`;
                }

                if (field.alias) {
                    yaml += `${propIndent}alias: ${field.alias}\n`;
                }

                if (field.description) {
                    yaml += `${propIndent}description: ${field.description}\n`;
                }

                if (field.default !== undefined && field.default !== null && field.default !== '') {
                    yaml += `${propIndent}default: ${field.default}\n`;
                }
            });
        }
        return yaml;
    },

    /**
     * Generate sample JSON for an event
     */
    generateEventJson(event, customTypes = {}) {
        const sampleData = { type: event.name };

        if (event.fields && event.fields.length > 0) {
            event.fields.forEach((field) => {
                let sampleValue;

                // Use default if available
                if (field.default !== undefined && field.default !== null && field.default !== '') {
                    sampleValue = field.default;
                } else if (customTypes[field.type]) {
                    // Use first value from custom type
                    sampleValue = customTypes[field.type][0];
                } else {
                    // Generate sample based on type
                    switch (field.type) {
                        case 'str':
                            sampleValue = `"${field.name}_value"`;
                            break;
                        case 'int':
                            sampleValue = 42;
                            break;
                        case 'float':
                            sampleValue = 3.14;
                            break;
                        case 'bool':
                            sampleValue = true;
                            break;
                        case 'list[str]':
                            sampleValue = ['item1', 'item2'];
                            break;
                        case 'dict[str, Any]':
                            sampleValue = { key: 'value' };
                            break;
                        default:
                            sampleValue = `"${field.name}_value"`;
                    }
                }

                const key = field.alias || field.name;
                sampleData[key] = sampleValue;
            });
        }

        return JSON.stringify(sampleData, null, 2);
    },

    /**
     * Generate JavaScript object representation
     */
    generateJS(protocol) {
        return JSON.stringify(protocol, null, 2);
    },

    // Built-in types that are always valid
    BUILTIN_TYPES: ['str', 'int', 'float', 'bool', 'list[str]', 'dict[str, Any]'],

    /**
     * Parse YAML string back into a protocol object
     */
    parseYAML(yamlText) {
        const protocol = {
            name: '',
            version: '',
            description: '',
            types: {},
            features: {},
            client: [],
            server: [],
        };
        const warnings = [];

        // Normalize line endings (CRLF -> LF)
        const normalizedText = yamlText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        const lines = normalizedText.split('\n');
        let currentSection = null; // 'types', 'client', 'server', 'features'

        let currentFeatureName = null;
        let featureSide = null; // 'client' or 'server' inside a feature

        let currentType = null;
        let currentEvent = null;
        let currentField = null;
        let inDescription = false;
        let descriptionLines = [];

        // Known top-level keys
        const knownTopLevel = ['name', 'version', 'description', 'types', 'client', 'server', 'features'];
        // Known event keys
        const knownEventKeys = ['name', 'handler_group', 'description', 'fields'];
        // Known field keys
        const knownFieldKeys = ['name', 'type', 'required', 'alias', 'description', 'default'];

        for (let i = 0; i < lines.length; i++) {
            const lineNum = i + 1;
            const line = lines[i];
            const trimmed = line.trim();

            // Skip empty lines and comments
            if (!trimmed || trimmed.startsWith('#')) {
                inDescription = false;
                continue;
            }

            // Handle multi-line description continuation
            if (inDescription && line.startsWith('  ') && !trimmed.includes(':')) {
                descriptionLines.push(trimmed);
                protocol.description = descriptionLines.join('\n');
                continue;
            } else {
                inDescription = false;
            }

            // Top-level
            if (!line.startsWith(' ') && trimmed.includes(':')) {
                const key = trimmed.split(':')[0];

                if (key === 'name') {
                    protocol.name = this._extractValue(line, 'name:');
                } else if (key === 'version') {
                    protocol.version = this._extractValue(line, 'version:').replace(/['"]/g, '');
                } else if (key === 'description') {
                    const value = this._extractValue(line, 'description:');
                    if (value === '|') {
                        inDescription = true;
                        descriptionLines = [];
                    } else {
                        protocol.description = value;
                    }
                } else if (key === 'types') {
                    currentSection = 'types';
                    currentType = null;
                } else if (key === 'features') {
                    currentSection = 'features';
                    currentFeatureName = null;
                } else if (key === 'client') {
                    currentSection = 'client';
                    currentEvent = null;
                } else if (key === 'server') {
                    currentSection = 'server';
                    currentEvent = null;
                } else if (!knownTopLevel.includes(key)) {
                    warnings.push(`Line ${lineNum}: Unrecognized top-level key "${key}"`);
                }
            }
            // Types
            else if (currentSection === 'types') {
                if (line.match(/^  \w+:$/)) {
                    currentType = trimmed.replace(':', '');
                    protocol.types[currentType] = [];
                } else if (line.match(/^    - /) && currentType) {
                    const value = trimmed.replace(/^- /, '');
                    protocol.types[currentType].push(value);
                }
            }
            // FEATURES SECTION
            else if (currentSection === 'features') {
                // Feature Name (2 spaces)
                if (line.match(/^  \w+:$/)) {
                    currentFeatureName = trimmed.replace(':', '');
                    protocol.features[currentFeatureName] = { client: [], server: [] };
                    featureSide = null;
                }
                // Feature Side (4 spaces)
                else if (currentFeatureName && line.match(/^    (client|server):$/)) {
                    featureSide = trimmed.replace(':', '');
                }
                // Feature Event (6 spaces)
                else if (currentFeatureName && featureSide && line.match(/^      - name:/)) {
                    currentEvent = {
                        name: this._extractValue(line, 'name:'),
                        handler_group: '',
                        description: '',
                        fields: [],
                    };
                    currentField = null;
                    protocol.features[currentFeatureName][featureSide].push(currentEvent);
                }
                // Parsing detailed event/field data for features reuses logic below?
                // The nesting is deeper here. I need to handle properties specifically or generalize.
                // Given the indent variance, I will add specific blocks here for 8/10/12 spaces.

                // Event Properties (8 spaces)
                else if (currentEvent && line.match(/^        \w/)) {
                    const key = trimmed.split(':')[0];
                    if (key === 'handler_group') currentEvent.handler_group = this._extractValue(line, 'handler_group:');
                    else if (key === 'description') currentEvent.description = this._extractValue(line, 'description:');
                    else if (key === 'fields') currentField = null;
                }
                // Feature Field (10 spaces)
                else if (currentEvent && line.match(/^          - name:/)) {
                    currentField = {
                        name: this._extractValue(line, 'name:'),
                        type: 'str',
                        required: true,
                    };
                    currentEvent.fields.push(currentField);
                }
                // Feature Field Properties (12 spaces)
                else if (currentField && line.match(/^            \w/)) {
                    const key = trimmed.split(':')[0];
                    if (key === 'type') currentField.type = this._extractValue(line, 'type:');
                    else if (key === 'required') currentField.required = this._extractValue(line, 'required:') !== 'false';
                    else if (key === 'alias') currentField.alias = this._extractValue(line, 'alias:');
                    else if (key === 'description') currentField.description = this._extractValue(line, 'description:');
                    else if (key === 'default') currentField.default = this._extractValue(line, 'default:');
                }
            }
            // ROOT Client/Server
            else if (currentSection === 'client' || currentSection === 'server') {
                if (line.match(/^  - name:/)) {
                    currentEvent = {
                        name: this._extractValue(line, 'name:'),
                        handler_group: '',
                        description: '',
                        fields: [],
                    };
                    currentField = null;
                    protocol[currentSection].push(currentEvent);
                }
                else if (currentEvent && line.match(/^    \w/)) {
                    const key = trimmed.split(':')[0];
                    if (key === 'handler_group') currentEvent.handler_group = this._extractValue(line, 'handler_group:');
                    else if (key === 'description') currentEvent.description = this._extractValue(line, 'description:');
                    else if (key === 'fields') currentField = null;
                }
                else if (line.match(/^      - name:/)) {
                    currentField = {
                        name: this._extractValue(line, 'name:'),
                        type: 'str',
                        required: true,
                    };
                    if (currentEvent) currentEvent.fields.push(currentField);
                }
                else if (currentField && line.match(/^        \w/)) {
                    const key = trimmed.split(':')[0];
                    if (key === 'type') currentField.type = this._extractValue(line, 'type:');
                    else if (key === 'required') currentField.required = this._extractValue(line, 'required:') !== 'false';
                    else if (key === 'alias') currentField.alias = this._extractValue(line, 'alias:');
                    else if (key === 'description') currentField.description = this._extractValue(line, 'description:');
                    else if (key === 'default') currentField.default = this._extractValue(line, 'default:');
                }
            }
        }

        return { protocol, warnings };
    },

    /**
     * Helper to extract value after a key
     */
    _extractValue(line, key) {
        const idx = line.indexOf(key);
        if (idx === -1) return '';
        return line.slice(idx + key.length).trim();
    }
};

// Make available globally for Alpine.js
window.YamlGenerator = YamlGenerator;
