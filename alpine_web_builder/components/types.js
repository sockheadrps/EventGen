// Custom Types Alpine.js Component
document.addEventListener('alpine:init', () => {
  Alpine.data('customTypes', (params = {}) => ({
    // Component props
    types: params.types || {},

    // Local state
    collapsed: false,

    init() {
      // Listen for data updates from main component
      document.addEventListener('types-updated', () => {
        if (window.protocolBuilderInstance) {
          this.types = window.protocolBuilderInstance.protocol.types;
        }
      });
    },

    openTypeModal() {
      this.$dispatch('open-type-modal');
    },

    editType(typeName) {
      this.$dispatch('edit-type', { typeName });
    },

    deleteType(typeName) {
      if (confirm('Are you sure you want to delete this type?')) {
        this.$dispatch('delete-type', { typeName });
      }
    },

    toggleCollapse() {
      this.collapsed = !this.collapsed;
    }
  }));
});
