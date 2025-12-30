// Events Alpine.js Component
document.addEventListener('alpine:init', () => {
  Alpine.data('eventsComponent', (params = {}) => ({
    // Component props (will be bound dynamically)
    events: params.events || [],
    side: params.side || 'client',
    title: params.title || 'Events',
    description: params.description || 'Event description',

    // Local state
    collapsed: false,

    init() {
      // Listen for data updates from main component
      const updateEvents = () => {
        if (window.protocolBuilderInstance) {
          // Using getCurrentEvents handles both default and feature-specific contexts
          this.events = window.protocolBuilderInstance.getCurrentEvents(this.side);
        }
      };

      document.addEventListener('events-updated-' + this.side, updateEvents);
      window.addEventListener('feature-changed', updateEvents);
    },

    openEventModal() {
      this.$dispatch('open-event-modal', {
        side: this.side,
        isNew: true
      });
    },

    editEvent(index) {
      this.$dispatch('edit-event', {
        side: this.side,
        index: index,
        event: this.events[index]
      });
    },

    deleteEvent(index) {
      if (confirm('Are you sure you want to delete this event?')) {
        this.events.splice(index, 1);
        this.$dispatch('events-updated', {
          side: this.side,
          events: this.events
        });
      }
    },

    openEventDetail(index) {
      this.$dispatch('event-detail-requested', {
        side: this.side,
        index: index,
        event: this.events[index]
      });
    },

    toggleCollapse() {
      this.collapsed = !this.collapsed;
    }
  }));
});