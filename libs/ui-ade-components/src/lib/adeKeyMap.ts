//https://mantine.dev/hooks/use-hotkeys/

export const adeKeyMap = {
  OPEN_NETWORK_INSPECTOR: {
    command: 'mod+shift+g',
  },
  ENABLE_DEBUG_MODE: {
    command: 'mod+shift+u'
  },
  RESET_MESSAGES: {
    command: 'shift+alt+r',
  },
  HIDE_REASONING: {
    command: 'mod+shift+h',
  },
  SAVE_CUSTOM_TOOL: {
    command: 'mod+s',
  },
  TOGGLE_RUN_DEBUGGER: {
    command: 'shift+alt+d',
  },
  CONTEXT_VIEWER: {
    command: 'shift+alt+c',
  },
  OPEN_TEMPLATE_SETTINGS_PANEL: {
    command: 'shift+0',
  },
  OPEN_AGENT_SETTINGS_PANEL: {
    command: 'shift+1',
  },
  OPEN_TOOLS_PANEL: {
    command: 'shift+2',
  },
  OPEN_DATASOURCES_PANEL: {
    command: 'shift+3',
  },
  OPEN_ADVANCED_SETTINGS: {
    command: 'shift+4',
  },
  OPEN_CORE_MEMORY_PANEL: {
    command: 'shift+6',
  },
  OPEN_ARCHIVAL_MEMORY_PANEL: {
    command: 'shift+7',
  },
  SHOW_HOTKEYS: {
    command: 'mod+/',
  }
} as const;
