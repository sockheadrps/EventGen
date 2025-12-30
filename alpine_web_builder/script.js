/**
 * Protocol Builder - Main Alpine.js Component
 * A visual builder for wsprot protocol definitions
 */

function protocolBuilder() {
  return {
    // ========================================
    // Data Structure
    // ========================================
    protocol: {
      name: '',
      version: '',
      description: '',
      types: {},
      features: {}, // { FeatureName: { client: [], server: [] } }
      client: [], // Default feature events
      server: [], // Default feature events
    },

    // ========================================
    // UI State
    // ========================================

    // Protocol editing
    isEditingProtocol: false,
    currentFeature: null, // null = Default, string = Feature Name

    // Modal visibility
    showTypeModal: false,
    showEventModal: false,
    showFieldModal: false,
    showEventDetail: false,
    // Generation Options
    genOptionsModalVisible: false,
    genOptions: {
      includeServer: true,
      includeClient: true,
      includeWebClient: true,
      integrateWebClient: false,
    },

    // Collapse states
    typesCollapsed: false,
    clientEventsCollapsed: false,
    serverEventsCollapsed: false,

    // Optional field expansion states
    fieldDefaultExpanded: false,
    fieldAliasExpanded: false,
    fieldDescExpanded: false,
    eventGroupExpanded: false,
    eventDescExpanded: false,

    // ========================================
    // Modal State
    // ========================================

    // Type modal
    typeModalTitle: 'Add Custom Type',
    currentType: { name: '', valuesText: '' },
    editingTypeName: null,

    // Event modal
    eventModalTitle: 'Add Event',
    currentEvent: { name: '', handler_group: '', description: '', fields: [] },
    editingEvent: null,
    editingEventSide: null,
    isNewEvent: true,
    copyFromEvent: '',
    eventModalRefresh: 0,

    // Field modal
    fieldModalTitle: 'Add Field',
    currentField: { name: '', type: 'str', required: true },
    editingFieldIndex: null,

    // Event detail
    detailEvent: null,
    detailEventJson: '',
    detailSampleValues: {}, // { fieldName: selectedValue }

    // New Modals State
    importModalVisible: false,
    helpModalVisible: false,
    viewSourceModalVisible: false,

    // View Source State
    viewSourceMode: 'yaml', // 'yaml' or 'js'
    sourceOutput: '',

    // Import State
    importInput: '',

    // ========================================
    // Initialization
    // ========================================

    init() {
      // Default to blank protocol (User requested no auto-load)
      // Store global reference for onclick handlers that need it
      window.protocolBuilderInstance = this;
    },

    hasProtocolContent() {
      return Object.keys(this.protocol.types).length > 0 ||
        this.protocol.client.length > 0 ||
        this.protocol.server.length > 0 ||
        (this.protocol.features && Object.keys(this.protocol.features).length > 0);
    },

    // ========================================
    // Helper Functions
    // ========================================

    getFieldTypeDisplay(field) {
      return field?.type || 'unknown';
    },

    toggleOptional(fieldName) {
      this[fieldName] = !this[fieldName];
    },

    // ========================================
    // Protocol Management
    // ========================================

    clearToBlank() {
      this.protocol = {
        name: '',
        version: '',
        description: '',
        types: {},
        features: {},
        client: [],
        server: [],
      };
      this.currentFeature = null;
    },

    generateYAML() {
      if (window.YamlGenerator) {
        this.sourceOutput = window.YamlGenerator.generateYAML(this.protocol);
      }

    },

    // ========================================
    // Feature Management
    // ========================================

    selectFeature(name) {
      this.currentFeature = name;
      window.dispatchEvent(new CustomEvent('feature-changed'));
    },

    addFeature() {
      const name = prompt("Enter Feature Name (e.g. 'Chat', 'Game'):");
      if (!name) return;

      const cleanName = name.trim();
      if (this.protocol.features[cleanName] || cleanName === 'Default') {
        alert('Feature already exists!');
        return;
      }

      this.protocol.features[cleanName] = { client: [], server: [] };
      this.currentFeature = cleanName;
      this.generateYAML();
      window.dispatchEvent(new CustomEvent('feature-changed'));
    },

    deleteFeature(name) {
      if (confirm(`Delete feature "${name}" and all its events?`)) {
        delete this.protocol.features[name];
        if (this.currentFeature === name) {
          this.currentFeature = null;
        }
        this.generateYAML();
        window.dispatchEvent(new CustomEvent('feature-changed'));
      }
    },

    getCurrentEvents(side) {
      if (this.currentFeature && this.protocol.features[this.currentFeature]) {
        return this.protocol.features[this.currentFeature][side];
      }
      return this.protocol[side];
    },

    getCurrentClientEvents() {
      return this.getCurrentEvents('client');
    },

    getCurrentServerEvents() {
      return this.getCurrentEvents('server');
    },

    updateSourceView() {
      if (!window.YamlGenerator) return;

      if (this.viewSourceMode === 'yaml') {
        this.sourceOutput = window.YamlGenerator.generateYAML(this.protocol);
      } else {
        this.sourceOutput = window.YamlGenerator.generateJS(this.protocol);
      }
    },

    async confirmGenerateCode() {
      this.genOptionsModalVisible = false;

      // Prepare options
      const options = {
        include_server: this.genOptions.includeServer,
        include_client: this.genOptions.includeClient,
        include_webclient: this.genOptions.includeWebClient,
        integrate_webclient: this.genOptions.includeWebClient && this.genOptions.integrateWebClient,
      };

      await this.generateCode(options);
    },

    async generateCode(options = {}) {
      // Generate YAML first
      this.generateYAML();

      if (!this.sourceOutput) {
        alert('Failed to generate YAML');
        return;
      }

      try {
        const response = await fetch('/api/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            yaml: this.sourceOutput,
            options: options
          })
        });

        const data = await response.json();

        if (data.success) {
          window.location.href = '/viewer.html?session=' + data.sessionId;
        } else {
          alert('Generation failed: ' + (data.error || 'Unknown error'));
        }
      } catch (err) {
        console.error('API Error:', err);
        alert('Failed to connect to generation server. Is python server running?');
      }
    },

    loadExample() {
      this.protocol = {
        name: 'RPGProtocol',
        version: '2.0',
        description: 'Full-featured RPG multiplayer protocol demonstrating all schema capabilities.',
        types: {
          SessionAction: ['create', 'join', 'leave', 'close'],
          PartyAction: ['invite', 'accept', 'kick', 'promote'],
          PlayerStatus: ['online', 'offline', 'in_combat', 'idle'],
          PlayerRole: ['leader', 'member'],
          ItemRarity: ['common', 'uncommon', 'rare', 'epic', 'legendary'],
          InventoryAction: ['add', 'remove', 'equip', 'unequip'],
          EquipmentSlot: ['head', 'chest', 'legs', 'weapon', 'offhand'],
          CombatAction: ['attack', 'defend', 'cast_spell', 'flee'],
          DamageType: ['physical', 'fire', 'ice', 'lightning', 'poison'],
          SpellSchool: ['fire', 'frost', 'arcane', 'nature', 'shadow'],
          ChatChannel: ['global', 'party', 'whisper'],
          QuestStatus: ['available', 'accepted', 'completed', 'failed'],
          Difficulty: ['easy', 'normal', 'hard', 'nightmare'],
          ErrorCode: ['invalid_action', 'unauthorized', 'not_found', 'cooldown', 'server_error'],
          YesNo: ['yes', 'no'],
        },
        client: [
          {
            name: 'session_action',
            handler_group: 'session',
            description: 'Create, join, leave, or close a game session',
            fields: [
              { name: 'action', type: 'SessionAction', required: true },
              { name: 'session_id', type: 'str', required: false, alias: 'sessionId' },
              { name: 'difficulty', type: 'Difficulty', required: false },
            ],
          },
          {
            name: 'party_action',
            handler_group: 'party',
            description: 'Manage party membership',
            fields: [
              { name: 'action', type: 'PartyAction', required: true },
              { name: 'target_player', type: 'str', required: true, alias: 'targetPlayer' },
            ],
          },
          {
            name: 'inventory_action',
            handler_group: 'inventory',
            description: 'Modify inventory or equipment',
            fields: [
              { name: 'action', type: 'InventoryAction', required: true },
              { name: 'item_id', type: 'str', required: true, alias: 'itemId' },
              { name: 'slot', type: 'EquipmentSlot', required: false },
            ],
          },
          {
            name: 'combat_action',
            handler_group: 'combat',
            description: 'Perform a combat action',
            fields: [
              { name: 'action', type: 'CombatAction', required: true },
              { name: 'target_id', type: 'str', required: true, alias: 'targetId' },
              { name: 'spell_school', type: 'SpellSchool', required: false, alias: 'spellSchool' },
            ],
          },
          {
            name: 'send_chat',
            handler_group: 'chat',
            description: 'Send a chat message',
            fields: [
              { name: 'channel', type: 'ChatChannel', required: true },
              { name: 'message', type: 'str', required: true },
              { name: 'target_player', type: 'str', required: false, alias: 'targetPlayer' },
            ],
          },
          {
            name: 'quest_action',
            handler_group: 'quest',
            description: 'Accept or complete a quest',
            fields: [
              { name: 'quest_id', type: 'str', required: true, alias: 'questId' },
              { name: 'status', type: 'QuestStatus', required: true },
            ],
          },
          {
            name: 'request_player_info',
            handler_group: 'player',
            description: 'Request information about a player',
            fields: [
              { name: 'player', type: 'str', required: true },
            ],
          },
          {
            name: 'toggle_ready',
            handler_group: 'session',
            description: 'Toggle ready state',
            fields: [
              { name: 'ready', type: 'YesNo', required: true },
            ],
          },
          {
            name: 'ping',
            handler_group: 'system',
            description: 'Ping server for latency check',
            fields: [
              { name: 'timestamp', type: 'int', required: true },
            ],
          },
        ],
        server: [
          {
            name: 'session_update',
            description: 'Session state changed',
            fields: [
              { name: 'session_id', type: 'str', required: true, alias: 'sessionId' },
              { name: 'players', type: 'list[str]', required: true },
              { name: 'difficulty', type: 'Difficulty', required: true },
            ],
          },
          {
            name: 'party_update',
            description: 'Party composition changed',
            fields: [
              { name: 'leader', type: 'str', required: true },
              { name: 'members', type: 'list[str]', required: true },
            ],
          },
          {
            name: 'player_status',
            description: 'Player status update',
            fields: [
              { name: 'player', type: 'str', required: true },
              { name: 'status', type: 'PlayerStatus', required: true },
            ],
          },
          {
            name: 'inventory_update',
            description: 'Inventory changed',
            fields: [
              { name: 'item_id', type: 'str', required: true, alias: 'itemId' },
              { name: 'rarity', type: 'ItemRarity', required: true },
              { name: 'equipped', type: 'bool', required: true },
            ],
          },
          {
            name: 'combat_result',
            description: 'Result of a combat action',
            fields: [
              { name: 'source', type: 'str', required: true },
              { name: 'target', type: 'str', required: true },
              { name: 'damage', type: 'int', required: true },
              { name: 'damage_type', type: 'DamageType', required: true, alias: 'damageType' },
            ],
          },
          {
            name: 'chat_message',
            description: 'Incoming chat message',
            fields: [
              { name: 'channel', type: 'ChatChannel', required: true },
              { name: 'sender', type: 'str', required: true },
              { name: 'message', type: 'str', required: true },
              { name: 'timestamp', type: 'int', required: true },
            ],
          },
          {
            name: 'quest_update',
            description: 'Quest status changed',
            fields: [
              { name: 'quest_id', type: 'str', required: true, alias: 'questId' },
              { name: 'status', type: 'QuestStatus', required: true },
            ],
          },
          {
            name: 'pong',
            description: 'Ping response',
            fields: [
              { name: 'timestamp', type: 'int', required: true },
            ],
          },
          {
            name: 'error',
            description: 'Error response',
            fields: [
              { name: 'code', type: 'ErrorCode', required: true },
              { name: 'message', type: 'str', required: true },
              { name: 'retryable', type: 'bool', required: false },
            ],
          },
        ],
      };
      this.generateYAML();
    },

    // ========================================
    // New Modals Logic
    // ========================================

    // --- View Source ---
    openViewSource() {
      this.viewSourceModalVisible = true;
      this.updateSourceView();
    },

    updateSourceView() {
      if (this.viewSourceMode === 'yaml') {
        this.sourceOutput = window.YamlGenerator
          ? window.YamlGenerator.generateYAML(this.protocol)
          : this._fallbackGenerateYAML();
      } else {
        this.sourceOutput = JSON.stringify(this.protocol, null, 2);
      }
    },

    copySource() {
      if (!this.sourceOutput) return;
      navigator.clipboard.writeText(this.sourceOutput).then(() => {
        if (window.Notifications) window.Notifications.success('Copied to clipboard!');
      });
    },

    generateEventJson(event) {
      if (window.YamlGenerator) {
        return window.YamlGenerator.generateEventJson(event, this.protocol.types);
      }
      return JSON.stringify({ type: event?.name || 'unknown' }, null, 2);
    },

    // --- Import ---
    openImportModal() {
      this.importModalVisible = true;
      this.importInput = '# Paste your YAML protocol here...';
    },

    loadFromYAML() {
      const yamlText = this.importInput.trim();
      if (!yamlText) return;

      if (!window.YamlGenerator || !window.YamlGenerator.parseYAML) {
        alert('YAML parser not available');
        return;
      }

      try {
        const result = window.YamlGenerator.parseYAML(yamlText);
        const { protocol: parsed, warnings } = result;

        if (!parsed.name && parsed.client.length === 0 && parsed.server.length === 0) {
          alert('Could not parse YAML.');
          return;
        }

        this.protocol = parsed;
        document.dispatchEvent(new CustomEvent('types-updated'));
        document.dispatchEvent(new CustomEvent('events-updated-client'));
        document.dispatchEvent(new CustomEvent('events-updated-server'));

        // Success
        const summary = `Loaded: ${parsed.name || 'Protocol'}`;
        if (window.Notifications) window.Notifications.success(summary);

        this.importModalVisible = false;
        this.importInput = '';

      } catch (e) {
        alert('Error parsing YAML: ' + e.message);
      }
    },

    // --- Help / Example ---
    async loadExampleSimple() {
      await this._loadExampleFromFile('examples/chat.yaml', 'Simple Chat example loaded!');
    },

    async loadExampleComplex() {
      await this._loadExampleFromFile('examples/rpg.yaml', 'Complex RPG example loaded!');
    },

    async _loadExampleFromFile(filename, successMessage) {
      try {
        const response = await fetch(filename);
        if (!response.ok) {
          throw new Error(`Failed to load ${filename}: ${response.status}`);
        }
        const yamlText = await response.text();

        if (window.YamlGenerator) {
          const { protocol, warnings } = window.YamlGenerator.parseYAML(yamlText);
          this.protocol = protocol;
          if (warnings.length > 0) {
            console.warn('YAML parse warnings:', warnings);
          }
        } else {
          console.error('YamlGenerator not available');
          return;
        }

        this._finishLoadExample(successMessage);
      } catch (error) {
        console.error('Failed to load example:', error);
        if (window.Notifications) {
          window.Notifications.error('Failed to load example: ' + error.message);
        }
      }
    },

    _finishLoadExample(msg) {
      this.helpModalVisible = false;
      this.currentFeature = null; // Reset to Default feature
      window.dispatchEvent(new CustomEvent('feature-changed'));
      document.dispatchEvent(new CustomEvent('types-updated'));
      document.dispatchEvent(new CustomEvent('events-updated-client'));
      document.dispatchEvent(new CustomEvent('events-updated-server'));
      if (window.Notifications) window.Notifications.success(msg);
    },

    // Fallback YAML generation if module not loaded
    _fallbackGenerateYAML() {
      let yaml = `name: ${this.protocol.name}\n`;
      if (this.protocol.version) yaml += `version: '${this.protocol.version}'\n`;
      if (this.protocol.description) yaml += `description: ${this.protocol.description}\n`;
      return yaml;
    },

    // ========================================
    // Type Modal Operations
    // ========================================

    openTypeModal() {
      this.currentType = { name: '', valuesText: '' };
      this.editingTypeName = null;
      this.typeModalTitle = 'Add Custom Type';
      this.showTypeModal = true;
    },

    editType(data) {
      const typeName = typeof data === 'string' ? data : data.typeName;
      this.editingTypeName = typeName;
      this.currentType = {
        name: typeName,
        valuesText: this.protocol.types[typeName].join('\n'),
      };
      this.typeModalTitle = 'Edit Custom Type';
      this.showTypeModal = true;
    },

    saveType() {
      if (!this.currentType.name.trim()) {
        alert('Type name is required');
        return;
      }

      const values = this.currentType.valuesText
        .split('\n')
        .map((v) => v.trim())
        .filter((v) => v.length > 0);

      if (values.length === 0) {
        alert('At least one value is required');
        return;
      }

      // If editing and name changed, delete old
      if (this.editingTypeName && this.editingTypeName !== this.currentType.name) {
        delete this.protocol.types[this.editingTypeName];
      }

      this.protocol.types[this.currentType.name] = values;
      this.closeTypeModal();
      this.generateYAML();
      document.dispatchEvent(new CustomEvent('types-updated'));
    },

    deleteType(data) {
      const typeName = typeof data === 'string' ? data : data.typeName;
      if (confirm(`Delete type "${typeName}"?`)) {
        delete this.protocol.types[typeName];
        this.generateYAML();
        document.dispatchEvent(new CustomEvent('types-updated'));
      }
    },

    closeTypeModal() {
      this.showTypeModal = false;
      this.editingTypeName = null;
    },

    // ========================================
    // Event Modal Operations
    // ========================================

    openEventModal(data) {
      this.editingEventSide = data.side;
      this.isNewEvent = data.isNew !== false;
      this.editingEvent = null;
      this.copyFromEvent = '';

      this.currentEvent = {
        name: '',
        handler_group: '',
        description: '',
        fields: [],
      };

      this.eventModalTitle = `Add ${data.side.charAt(0).toUpperCase() + data.side.slice(1)} Event`;
      this.eventModalRefresh = Date.now();

      // Show modal
      this.showEventModal = true;
      const modal = document.getElementById('event-modal');
      if (modal) modal.style.display = 'flex';
    },

    editEvent(data) {
      this.editingEventSide = data.side;
      this.isNewEvent = false;
      this.editingEvent = data.index;

      // Deep copy the event
      const eventCopy = JSON.parse(JSON.stringify(data.event));
      this.currentEvent = {
        ...eventCopy,
        fields: eventCopy.fields || [],
      };

      this.eventModalTitle = `Edit ${data.side.charAt(0).toUpperCase() + data.side.slice(1)} Event`;
      this.eventModalRefresh = Date.now();

      // Show modal
      this.showEventModal = true;
      const modal = document.getElementById('event-modal');
      if (modal) modal.style.display = 'flex';
    },

    saveEvent() {
      // Read values from DOM as fallback
      const nameInput = document.getElementById('event-name');
      const groupInput = document.getElementById('event-group');
      const descInput = document.getElementById('event-description');

      if (nameInput) this.currentEvent.name = nameInput.value.trim();
      if (groupInput) this.currentEvent.handler_group = groupInput.value.trim();
      if (descInput) this.currentEvent.description = descInput.value.trim();

      if (!this.currentEvent.name) {
        alert('Event name is required');
        return;
      }

      const eventData = JSON.parse(JSON.stringify(this.currentEvent));
      const eventsList = this.getCurrentEvents(this.editingEventSide);

      if (this.editingEvent !== null) {
        eventsList[this.editingEvent] = eventData;
      } else {
        eventsList.push(eventData);
      }

      this.closeEventModal();
      this.generateYAML();
      document.dispatchEvent(new CustomEvent('events-updated-' + this.editingEventSide));
      window.dispatchEvent(new CustomEvent('feature-changed')); // Refresh event lists
    },

    deleteEvent(side, index) {
      const eventsList = this.getCurrentEvents(side);
      if (confirm(`Delete event "${eventsList[index].name}"?`)) {
        eventsList.splice(index, 1);
        this.generateYAML();
        document.dispatchEvent(new CustomEvent('events-updated-' + side));
        window.dispatchEvent(new CustomEvent('feature-changed')); // Refresh event lists
      }
    },

    closeEventModal() {
      if (this.showFieldModal) return; // Don't close if field modal is open

      this.showEventModal = false;
      this.copyFromEvent = '';
      const modal = document.getElementById('event-modal');
      if (modal) modal.style.display = 'none';
    },

    // Copy fields from another event
    getEventsForCopy() {
      const allEvents = [];

      this.protocol.client.forEach((event, index) => {
        allEvents.push({
          ...event,
          _side: 'client',
          _index: index,
        });
      });

      this.protocol.server.forEach((event, index) => {
        allEvents.push({
          ...event,
          _side: 'server',
          _index: index,
        });
      });

      return allEvents;
    },

    copyFieldsFromEvent() {
      if (!this.copyFromEvent) return;

      const selectedIndex = parseInt(this.copyFromEvent);
      const availableEvents = this.getEventsForCopy();

      if (selectedIndex >= 0 && selectedIndex < availableEvents.length) {
        const sourceEvent = availableEvents[selectedIndex];
        if (sourceEvent?.fields) {
          this.currentEvent.fields = JSON.parse(JSON.stringify(sourceEvent.fields));
          this.copyFromEvent = '';
          this.eventModalRefresh++;

          if (window.Notifications) {
            window.Notifications.success('Fields copied!');
          }
        }
      }
    },

    // ========================================
    // Field Modal Operations
    // ========================================

    openFieldModal(index = null) {
      if (index !== null) {
        this.editingFieldIndex = index;
        this.currentField = JSON.parse(JSON.stringify(this.currentEvent.fields[index]));
        this.fieldModalTitle = 'Edit Field';
      } else {
        this.editingFieldIndex = null;
        this.currentField = { name: '', type: 'str', required: true };
        this.fieldModalTitle = 'Add Field';
      }

      this.showFieldModal = true;
      const modal = document.getElementById('field-modal');
      if (modal) modal.style.display = 'flex';
    },

    saveField() {
      // Read values from DOM
      const nameInput = document.getElementById('field-name');
      const typeSelect = document.getElementById('field-type');
      const requiredCheckbox = document.querySelector('#field-modal input[type="checkbox"]');
      const defaultInput = document.getElementById('field-default');
      const aliasInput = document.getElementById('field-alias');
      const descInput = document.getElementById('field-description');

      if (nameInput) this.currentField.name = nameInput.value.trim();
      if (typeSelect) this.currentField.type = typeSelect.value;
      if (requiredCheckbox) this.currentField.required = requiredCheckbox.checked;
      if (defaultInput) this.currentField.default = defaultInput.value.trim() || undefined;
      if (aliasInput) this.currentField.alias = aliasInput.value.trim() || undefined;
      if (descInput) this.currentField.description = descInput.value.trim() || undefined;

      if (!this.currentField.name) {
        alert('Field name is required');
        return;
      }

      const fieldData = JSON.parse(JSON.stringify(this.currentField));

      if (this.editingFieldIndex !== null) {
        this.currentEvent.fields[this.editingFieldIndex] = fieldData;
      } else {
        this.currentEvent.fields.push(fieldData);
      }

      this.eventModalRefresh++;
      this.closeFieldModal();
    },

    deleteField(index) {
      if (confirm('Delete this field?')) {
        this.currentEvent.fields.splice(index, 1);
        this.eventModalRefresh++;
      }
    },

    editField(index) {
      if (this.currentEvent.fields[index]) {
        this.openFieldModal(index);
      }
    },

    closeFieldModal() {
      this.showFieldModal = false;
      const modal = document.getElementById('field-modal');
      if (modal) modal.style.display = 'none';
    },

    // ========================================
    // Event Detail Overlay
    // ========================================

    openEventDetail(side, index) {
      this.detailEvent = this.getCurrentEvents(side)[index];
      this.detailSampleValues = this._initSampleValues(this.detailEvent);
      this.detailEventJson = this._buildDetailJson();
      this.showEventDetail = true;
    },

    _initSampleValues(event) {
      const values = {};
      if (!event || !event.fields) return values;

      for (const field of event.fields) {
        if (this.protocol.types[field.type]) {
          // Custom type - use first value as default
          values[field.name] = this.protocol.types[field.type][0];
        } else {
          // Built-in type - use placeholder
          values[field.name] = this._getDefaultForType(field);
        }
      }
      return values;
    },

    _getDefaultForType(field) {
      if (field.default !== undefined) return field.default;
      switch (field.type) {
        case 'str': return `${field.name}_value`;
        case 'int': return 42;
        case 'float': return 3.14;
        case 'bool': return true;
        default: return `${field.name}_value`;
      }
    },

    _buildDetailJson() {
      if (!this.detailEvent) return '{}';
      const obj = { type: this.detailEvent.name };
      for (const field of (this.detailEvent.fields || [])) {
        const key = field.alias || field.name;
        obj[key] = this.detailSampleValues[field.name];
      }
      return JSON.stringify(obj, null, 2);
    },

    updateDetailSampleValue(fieldName, value) {
      this.detailSampleValues[fieldName] = value;
      this.detailEventJson = this._buildDetailJson();
    },

    isCustomType(typeName) {
      return !!this.protocol.types[typeName];
    },

    getTypeValues(typeName) {
      return this.protocol.types[typeName] || [];
    },

    closeEventDetail() {
      this.showEventDetail = false;
      this.detailEvent = null;
    },

    editEventFromDetail() {
      if (!this.detailEvent) return;
      const eventToEdit = this.detailEvent;
      const side = this.protocol.client.includes(eventToEdit) ? 'client' : 'server';
      const index = this.protocol[side].indexOf(eventToEdit);

      this.closeEventDetail();
      this.editEvent({
        side,
        index,
        event: eventToEdit
      });
    },

    deleteEventFromDetail() {
      if (!this.detailEvent) return;
      const side = this.protocol.client.includes(this.detailEvent) ? 'client' : 'server';
      const index = this.protocol[side].indexOf(this.detailEvent);
      this.closeEventDetail();
      this.deleteEvent(side, index);
    },

    // ========================================
    // Actions Modal
    // ========================================

    showActionsModal() {
      this.generateYAML();
      this.actionsModalVisible = true;
    },

    closeActionsModal() {
      this.actionsModalVisible = false;
    },

    // ========================================
    // Collapse Toggles
    // ========================================

    toggleTypesCollapse() {
      this.typesCollapsed = !this.typesCollapsed;
    },

    toggleClientEventsCollapse() {
      this.clientEventsCollapsed = !this.clientEventsCollapsed;
    },

    toggleServerEventsCollapse() {
      this.serverEventsCollapsed = !this.serverEventsCollapsed;
    },

    // ========================================
    // Event Handlers (for child components)
    // ========================================

    handleEventDetailRequest(data) {
      this.openEventDetail(data.side, data.index);
    },

    handleEventsUpdate(data) {
      this.protocol[data.side] = data.events;
      this.generateYAML();
    },

    // ========================================
    // Custom Tooltip System
    // ========================================

    showTooltip(event, content) {
      // Remove any existing tooltip
      this.hideTooltip();

      // Create tooltip element
      const tooltip = document.createElement('div');
      tooltip.id = 'custom-tooltip';
      tooltip.className = 'custom-tooltip';
      tooltip.textContent = content;
      document.body.appendChild(tooltip);

      // Position tooltip below the element
      const rect = event.target.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();

      let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
      let top = rect.bottom + 8;

      // Keep tooltip on screen
      if (left < 10) left = 10;
      if (left + tooltipRect.width > window.innerWidth - 10) {
        left = window.innerWidth - tooltipRect.width - 10;
      }

      tooltip.style.left = left + 'px';
      tooltip.style.top = top + 'px';
      tooltip.style.opacity = '1';
    },

    hideTooltip() {
      const existing = document.getElementById('custom-tooltip');
      if (existing) {
        existing.remove();
      }
    },
  };
}
