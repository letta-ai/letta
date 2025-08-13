export function getBrandFromModelName(model: string) {
  let brand: string | null = null;

  const includerMapper = {
    letta: 'letta',
    gpt: 'openai',
    openai: 'openai',
    claude: 'claude',
    meta: 'meta',
    mistral: 'mistral',
    qwen: 'qwen',
    nous: 'nous-research',
    snorkel: 'snorkel-ai',
    google: 'google',
    nvidia: 'nvidia',
    together: 'together',
    anthropic: 'claude',
  };

  Object.entries(includerMapper).forEach(([key, value]) => {
    if (model.split('/')[0].toLowerCase().includes(key)) {
      brand = value;
    }
  });

  return brand;
}
