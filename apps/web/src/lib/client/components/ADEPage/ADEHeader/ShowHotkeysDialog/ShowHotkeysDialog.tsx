import { Dialog, HotKey, VStack, HStack, Typography } from '@letta-cloud/ui-component-library';
import { adeKeyMap } from '@letta-cloud/ui-ade-components';
import { useTranslations } from '@letta-cloud/translations';
import { useHotkeys } from '@mantine/hooks';
import { useAtom } from 'jotai';
import React, { useMemo } from 'react';
import { showHotkeysAtom } from './showHotkeysAtom';

function useHotkeyTranslations() {
  const t = useTranslations(
    'projects/(projectSlug)/agents/(agentId)/AgentPage.ShowHotkeysDialog',
  );

  return {
    OPEN_NETWORK_INSPECTOR: t('openNetworkInspector'),
    ENABLE_DEBUG_MODE: t('enableDebugMode'),
    RESET_MESSAGES: t('resetMessages'),
    HIDE_REASONING: t('hideReasoning'),
    SAVE_CUSTOM_TOOL: t('saveCustomTool'),
    TOGGLE_RUN_DEBUGGER: t('toggleRunDebugger'),
    CONTEXT_VIEWER: t('contextViewer'),
    OPEN_TEMPLATE_SETTINGS_PANEL: t('openTemplateSettingsPanel'),
    OPEN_AGENT_SETTINGS_PANEL: t('openAgentSettingsPanel'),
    OPEN_TOOLS_PANEL: t('openToolsPanel'),
    OPEN_DATASOURCES_PANEL: t('openDatasourcesPanel'),
    OPEN_ADVANCED_SETTINGS: t('openAdvancedSettings'),
    OPEN_CORE_MEMORY_PANEL: t('openCoreMemoryPanel'),
    OPEN_ARCHIVAL_MEMORY_PANEL: t('openArchivalMemoryPanel'),
    SHOW_HOTKEYS: t('showHotkeys'),
  } satisfies Record<keyof typeof adeKeyMap, string>;
}

function isHotkeyCommand(command: string): command is keyof typeof adeKeyMap {
  return command in adeKeyMap;
}

export function ShowHotkeysDialog() {
  const [isOpen, setIsOpen] = useAtom(showHotkeysAtom);
  const t = useTranslations(
    'projects/(projectSlug)/agents/(agentId)/AgentPage.ShowHotkeysDialog',
  );
  const hotkeyLabels = useHotkeyTranslations();

  useHotkeys([[adeKeyMap.SHOW_HOTKEYS.command, () => setIsOpen(v => !v)]]);

  const hotkeyEntries = useMemo(() => {
    const entries: Array<{ label: string; command: string }> = [];

    for (const key in adeKeyMap) {
      if (isHotkeyCommand(key)) {
        entries.push({
          label: hotkeyLabels[key],
          command: adeKeyMap[key].command,
        });
      }
    }

    return entries;
  }, [hotkeyLabels]);

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      title={t('title')}
      hideConfirm
      disableSubmit
      disableForm
    >
      <VStack gap="small">
        {hotkeyEntries.map(({ label, command }) => (
          <HStack key={command} justify="spaceBetween" align="center">
            <Typography variant="body2">{label}</Typography>
            <HotKey command={command} />
          </HStack>
        ))}
      </VStack>
    </Dialog>
  );
}
