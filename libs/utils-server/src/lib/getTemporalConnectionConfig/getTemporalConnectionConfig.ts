import { environment } from '@letta-cloud/config-environment-variables';

/**
 * Gets the Temporal connection configuration based on environment variables
 * @returns Connection configuration object for Temporal client
 */
export function getTemporalConnectionConfig() {
  if (!environment.TEMPORAL_LETTUCE_CA_PEM) {
    return {
      address: environment.TEMPORAL_LETTUCE_API_HOST,
    };
  }

  const textEncoder = new TextEncoder();

  const cert = textEncoder.encode(environment.TEMPORAL_LETTUCE_CA_PEM);
  const key = textEncoder.encode(environment.TEMPORAL_LETTUCE_CA_KEY);

  return {
    address: environment.TEMPORAL_LETTUCE_API_HOST,
    tls: {
      clientCertPair: {
        crt: Buffer.from(cert),
        key: Buffer.from(key),
      },
    },
  };
}
