import { z } from 'zod';

export const GetADELayoutConfigOptionsSchema = z.object({
  panelLayout: z.array(z.number()),
});

export type GetADELayoutConfigOptions = z.infer<
  typeof GetADELayoutConfigOptionsSchema
>;

export function getADEConfigConstants() {
  const config = {
    ADELayoutQueryKey: ['adeLayoutConfig'],
    ADELayoutCookieName: 'adeLayoutConfig',
    serializeADELayoutConfig: (options: GetADELayoutConfigOptions) => {
      return JSON.stringify(options);
    },
    deserializeADELayoutConfig: (configString: string) => {
      try {
        return GetADELayoutConfigOptionsSchema.parse(
          JSON.parse(configString)
        );
      } catch (error) {
        console.error('Error parsing ADE layout config:', error);
        return undefined;
      }
    },
    generateCookieString: function (options: GetADELayoutConfigOptions) {
      return `${config.ADELayoutCookieName}=${config.serializeADELayoutConfig(options)};`;
    },
  };

  return config;
}
