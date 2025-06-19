interface AttachOptions {
  baseTemplateId?: string;
}

export function attachFilterByBaseTemplateIdToMetricsCounters({
  baseTemplateId,
}: AttachOptions) {
  if (!baseTemplateId) {
    return '';
  }

  return ` AND base_template_id = {baseTemplateId: String} `;
}
