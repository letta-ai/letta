import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import {
  DesktopConfigSchema,
  type DesktopConfigSchemaType,
} from '@letta-cloud/types';

export function getDesktopConfig(): DesktopConfigSchemaType | null {
  const homeDir = os.homedir();

  // desktopconfig is located in ~/.letta/desktop_config.json

  // read the file
  const desktopConfigPath = path.join(homeDir, '.letta', 'desktop_config.json');

  if (!fs.existsSync(desktopConfigPath)) {
    return null;
  }

  const desktopConfigContent = fs.readFileSync(desktopConfigPath, 'utf-8');

  // parse the file
  try {
    const desktopConfig = DesktopConfigSchema.parse(
      JSON.parse(desktopConfigContent),
    );
    return desktopConfig;
  } catch (_e) {
    return null;
  }
}

export function saveDesktopConfig(config: DesktopConfigSchemaType) {
  const homeDir = os.homedir();
  const desktopConfigPath = path.join(homeDir, '.letta', 'desktop_config.json');

  // write the file
  fs.writeFileSync(desktopConfigPath, JSON.stringify(config, null, 2));
}
